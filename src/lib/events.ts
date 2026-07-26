/** Public events: merge static seed data with CMS (admin) records */

import { EVENTS } from "@/lib/data";
import { parseJsonSafe, type EventBody, type CmsContentData } from "@/lib/cms-types";
import {
  listRecords,
  type BookingData,
  type SocialRegData,
  type SiteRecord,
} from "@/lib/sitedata";

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

/**
 * Free first-timer +1: guest email must never have attended a BnB class or event
 * (as a booked dancer, event registrant, or previous +1) — cancelled history counts.
 */
export function assertFirstTimerPlusOne(
  regs: SiteRecord<SocialRegData>[],
  plusEmail: string,
  opts?: { allowRegId?: string; bookings?: SiteRecord<BookingData>[] }
): { ok: true } | { ok: false; reason: string } {
  const email = plusEmail.trim().toLowerCase();
  if (!email) {
    return { ok: false, reason: "Email is required for a free first-timer +1." };
  }
  const base = assertPlusOneAvailable(regs, email, opts);
  if (!base.ok) return base;

  // Events / socials (including cancelled registrations)
  const beenToEvent = regs.some((r) => {
    if (opts?.allowRegId && r.id === opts.allowRegId) return false;
    return (
      (r.data.plus_one_email || "").toLowerCase() === email ||
      (r.data.member_email || "").toLowerCase() === email
    );
  });
  if (beenToEvent) {
    return {
      ok: false,
      reason:
        "This guest has been to a Boots N Boogie event before — free +1 is for first-timers only. Uncheck first-timer or they pay guest rate.",
    };
  }

  // Classes (any booking under this email, including cancelled)
  const bookings = opts?.bookings || [];
  const beenToClass = bookings.some(
    (b) => (b.data.member_email || "").toLowerCase() === email
  );
  if (beenToClass) {
    return {
      ok: false,
      reason:
        "This guest has been to a Boots N Boogie class before — free +1 is for first-timers only. Uncheck first-timer or they pay guest rate.",
    };
  }

  return { ok: true };
}

/** Load regs + bookings and validate free first-timer eligibility */
export async function validateFirstTimerGuest(
  plusEmail: string,
  opts?: { allowRegId?: string }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [regs, bookings] = await Promise.all([
    listRecords<SocialRegData>("social_regs", 500),
    listRecords<BookingData>("bookings", 500),
  ]);
  return assertFirstTimerPlusOne(regs, plusEmail, {
    allowRegId: opts?.allowRegId,
    bookings,
  });
}

/** Lowest non-zero ticket price on the event (used as paid +1 guest rate). */
export function guestTicketPrice(event: BnBEvent | null | undefined): number {
  if (!event?.tickets?.length) return 10;
  const prices = event.tickets.map((t) => Number(t.price) || 0).filter((p) => p > 0);
  if (!prices.length) return 10;
  return Math.min(...prices);
}

/**
 * Recompute social registration amount after add/edit/remove of a member’s +1.
 * Subscriber social: member entry free; free first-timer +1 = £0; paid +1 = guest ticket price.
 */
export function pricingAfterPlusOneChange(opts: {
  event: BnBEvent | null;
  isSubscriber: boolean;
  hasPlus: boolean;
  plusFirstTimer: boolean;
}): {
  amount_gbp: number;
  ticket_type: string;
  payment_status: string;
  payment_method: string;
  guestFee: number;
} {
  const guestFee = guestTicketPrice(opts.event);
  const isSocial = opts.event?.isSocial !== false;

  if (opts.isSubscriber && isSocial) {
    if (!opts.hasPlus) {
      return {
        amount_gbp: 0,
        ticket_type: "subscriber_free",
        payment_status: "complimentary",
        payment_method: "membership",
        guestFee: 0,
      };
    }
    if (opts.plusFirstTimer) {
      return {
        amount_gbp: 0,
        ticket_type: "subscriber_plus_one_free",
        payment_status: "complimentary",
        payment_method: "membership",
        guestFee: 0,
      };
    }
    // Paid +1 after solo free member booking — charge guest ticket only
    return {
      amount_gbp: guestFee,
      ticket_type: "subscriber_plus_one_paid",
      payment_status: "pay_at_door",
      payment_method: "pay_at_door",
      guestFee,
    };
  }

  // Non-social / non-member: keep guest fee additive if they have a paid +1
  if (opts.hasPlus && !opts.plusFirstTimer) {
    return {
      amount_gbp: guestFee,
      ticket_type: "plus_one_paid",
      payment_status: "pay_at_door",
      payment_method: "pay_at_door",
      guestFee,
    };
  }

  return {
    amount_gbp: 0,
    ticket_type: opts.hasPlus ? "plus_one_free" : "general",
    payment_status: "complimentary",
    payment_method: "complimentary",
    guestFee: 0,
  };
}
