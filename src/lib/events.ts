/** Public events: merge static seed data with CMS (admin) records */

import { EVENTS } from "@/lib/data";
import { parseJsonSafe, type EventBody, type CmsContentData } from "@/lib/cms-types";
import { listRecords, type SocialRegData, type SiteRecord } from "@/lib/sitedata";

export type BnBEvent = {
  id: string;
  title: string;
  dateLabel: string;
  dateISO: string;
  endDateISO?: string;
  time: string;
  doors: string;
  venue: string;
  address: string;
  image: string;
  status: "open" | "closed";
  isSocial: boolean;
  level: string;
  blurb: string;
  details: string[];
  tickets: { id: string; name: string; price: number }[];
  /** true when loaded from admin CMS */
  fromCms?: boolean;
};

function staticToEvent(e: (typeof EVENTS)[number]): BnBEvent {
  return {
    id: e.id,
    title: e.title,
    dateLabel: e.dateLabel,
    dateISO: e.dateISO,
    endDateISO: e.endDateISO,
    time: e.time,
    doors: e.doors || "",
    venue: e.venue,
    address: e.address,
    image: e.image,
    status: e.status,
    isSocial: e.isSocial,
    level: e.level,
    blurb: e.blurb,
    details: e.details,
    tickets: e.tickets,
    fromCms: false,
  };
}

export function cmsToEvent(row: SiteRecord<CmsContentData>): BnBEvent | null {
  if (row.data.content_type !== "event") return null;
  if (row.data.record_status === "deleted" || row.data.record_status === "archived") return null;
  // Only hide unpublished CMS events from the public site
  if (row.data.published === false) return null;

  const body = parseJsonSafe<EventBody>(row.data.body_json, {
    dateLabel: "",
    dateISO: "",
    time: "",
    venue: "",
    address: "",
    eventStatus: "closed",
    isSocial: false,
    level: "All levels",
    details: [],
    tickets: [],
  });

  const id = (row.data.slug || row.id).trim();
  if (!id) return null;

  return {
    id,
    title: row.data.title || "Event",
    dateLabel: body.dateLabel || body.dateISO || "",
    dateISO: body.dateISO || "",
    endDateISO: body.endDateISO,
    time: body.time || "",
    doors: body.doors || "",
    venue: body.venue || "",
    address: body.address || "",
    image: row.data.image_url || "/images/event-summer.jpg",
    status: body.eventStatus === "open" ? "open" : "closed",
    isSocial: !!body.isSocial,
    level: body.level || "All levels",
    blurb: row.data.summary || "",
    details: Array.isArray(body.details) ? body.details : [],
    tickets: Array.isArray(body.tickets) ? body.tickets : [],
    fromCms: true,
  };
}

/**
 * CMS records override static seeds with the same id/slug.
 * New CMS-only events (e.g. event-…) appear on the public list.
 */
export async function loadEvents(): Promise<BnBEvent[]> {
  const byId = new Map<string, BnBEvent>();
  for (const e of EVENTS) {
    byId.set(e.id, staticToEvent(e));
  }

  try {
    const rows = await listRecords<CmsContentData>("cms_content", 300);
    for (const row of rows) {
      if (row.data.content_type !== "event") continue;
      const ev = cmsToEvent(row);
      if (!ev) continue;
      byId.set(ev.id, ev);
    }
  } catch {
    /* offline / Site Data missing — fall back to static only */
  }

  return Array.from(byId.values()).sort((a, b) => {
    // Open first, then by date desc
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return (b.dateISO || "").localeCompare(a.dateISO || "");
  });
}

export async function loadEventById(id: string): Promise<BnBEvent | null> {
  const all = await loadEvents();
  return all.find((e) => e.id === id) || null;
}

/** Active (non-cancelled) registration for this member + event */
export function findMemberEventReg(
  regs: SiteRecord<SocialRegData>[],
  opts: { eventId: string; memberId: string; memberEmail: string }
): SiteRecord<SocialRegData> | undefined {
  const email = opts.memberEmail.toLowerCase();
  return regs.find(
    (r) =>
      r.data.record_status !== "cancelled" &&
      r.data.event_id === opts.eventId &&
      (r.data.member_id === opts.memberId ||
        (r.data.member_email || "").toLowerCase() === email)
  );
}

/**
 * +1 emails are unique forever across all events — one free/paid guest ticket identity.
 * Also blocks reusing someone who already attended as a member.
 */
export function assertPlusOneAvailable(
  regs: SiteRecord<SocialRegData>[],
  plusEmail: string,
  opts?: { allowRegId?: string }
): { ok: true } | { ok: false; reason: string } {
  const email = plusEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, reason: "Enter a valid email for your +1." };
  }

  for (const r of regs) {
    if (r.data.record_status === "cancelled") continue;
    if (opts?.allowRegId && r.id === opts.allowRegId) continue;

    if ((r.data.plus_one_email || "").toLowerCase() === email) {
      return {
        ok: false,
        reason:
          "This email is already assigned as someone’s +1 (for this or another event). Each guest can only be a +1 once.",
      };
    }
    if ((r.data.member_email || "").toLowerCase() === email) {
      return {
        ok: false,
        reason:
          "That email already has a dancer account registration — they should book their own ticket, not be a +1.",
      };
    }
  }
  return { ok: true };
}

/** Free first-timer +1: guest email must never have been a +1 or member at a social before */
export function assertFirstTimerPlusOne(
  regs: SiteRecord<SocialRegData>[],
  plusEmail: string,
  opts?: { allowRegId?: string }
): { ok: true } | { ok: false; reason: string } {
  const email = plusEmail.trim().toLowerCase();
  if (!email) {
    return { ok: false, reason: "Email is required for a free first-timer +1." };
  }
  const base = assertPlusOneAvailable(regs, email, opts);
  if (!base.ok) return base;

  // Extra: any historical cancelled reg still counts as "been before" for free first-timer
  const beenBefore = regs.some((r) => {
    if (opts?.allowRegId && r.id === opts.allowRegId) return false;
    return (
      (r.data.plus_one_email || "").toLowerCase() === email ||
      (r.data.member_email || "").toLowerCase() === email
    );
  });
  if (beenBefore) {
    return {
      ok: false,
      reason:
        "This guest has been to Boots N Boogie before — free +1 is for first-timers only. Uncheck first-timer or they pay guest rate.",
    };
  }
  return { ok: true };
}
