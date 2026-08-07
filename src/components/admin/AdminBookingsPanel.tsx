"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Check, MapPin, Users } from "lucide-react";
import { formatDateUK } from "@/lib/dates";
import { loadEvents, type BnBEvent } from "@/lib/events";
import { membershipFreeBookingCountsAsUsed } from "@/lib/membership";
import {
  updateRecord,
  type BookingData,
  type SocialRegData,
  type SiteRecord,
} from "@/lib/sitedata";

type SessionGroup = {
  key: string;
  kind: "class";
  date: string;
  time: string;
  title: string;
  classId: string;
  venue?: string;
  bookings: SiteRecord<BookingData>[];
};

type EventGroup = {
  key: string;
  kind: "event";
  date: string;
  time: string;
  title: string;
  eventId: string;
  venue?: string;
  regs: SiteRecord<SocialRegData>[];
};

type Group = SessionGroup | EventGroup;

export function AdminBookingsPanel({
  bookings,
  socials,
  onChange,
  toast,
}: {
  bookings: SiteRecord<BookingData>[];
  socials: SiteRecord<SocialRegData>[];
  onChange: (msg: string) => Promise<void> | void;
  toast: (msg: string, kind?: "ok" | "err") => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [eventsById, setEventsById] = useState<Record<string, BnBEvent>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  useEffect(() => {
    loadEvents()
      .then((list) => {
        const map: Record<string, BnBEvent> = {};
        for (const e of list) map[e.id] = e;
        setEventsById(map);
      })
      .catch(() => undefined);
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const groups: Group[] = useMemo(() => {
    const classMap = new Map<string, SessionGroup>();
    for (const b of bookings) {
      if (b.data.record_status === "cancelled") continue;
      const key = `class|${b.data.session_date}|${b.data.session_time}|${b.data.class_id}|${b.data.class_title}`;
      const cur = classMap.get(key) || {
        key,
        kind: "class" as const,
        date: b.data.session_date,
        time: b.data.session_time,
        title: b.data.class_title,
        classId: b.data.class_id,
        venue: b.data.venue_name,
        bookings: [] as SiteRecord<BookingData>[],
      };
      cur.bookings.push(b);
      classMap.set(key, cur);
    }

    const eventMap = new Map<string, EventGroup>();
    for (const s of socials) {
      if (s.data.record_status === "cancelled") continue;
      const ev = eventsById[s.data.event_id];
      const key = `event|${s.data.event_id}`;
      const cur = eventMap.get(key) || {
        key,
        kind: "event" as const,
        date: ev?.dateISO || "",
        time: ev?.time || "",
        title: s.data.event_title || ev?.title || "Event",
        eventId: s.data.event_id,
        venue: ev?.venue,
        regs: [] as SiteRecord<SocialRegData>[],
      };
      cur.regs.push(s);
      if (!cur.date && ev?.dateISO) cur.date = ev.dateISO;
      eventMap.set(key, cur);
    }

    let list: Group[] = [...classMap.values(), ...eventMap.values()];
    list.sort((a, b) => {
      const da = a.date || "9999";
      const db = b.date || "9999";
      if (da !== db) return da.localeCompare(db);
      return (a.time || "").localeCompare(b.time || "");
    });

    if (filter === "upcoming") {
      list = list.filter((g) => !g.date || g.date >= today);
    } else if (filter === "past") {
      list = list.filter((g) => g.date && g.date < today);
    }
    return list;
  }, [bookings, socials, eventsById, filter, today]);

  const selected = groups.find((g) => g.key === selectedKey) || null;

  async function setClassAttendance(b: SiteRecord<BookingData>, attended: boolean) {
    setBusyId(b.id);
    try {
      await updateRecord<BookingData>("bookings", b.id, {
        attended,
        record_status: attended ? "attended" : "no_show",
        // Keep payment as-is for free/paypal; mark paid if pay-at-class and attended
        ...(attended &&
        (b.data.payment_method === "pay_at_class" || b.data.payment_status === "pay_at_class")
          ? { payment_status: "paid" as const }
          : {}),
      });
      const freeNote =
        b.data.payment_method === "membership_free" && !attended
          ? " Free weekly class returned for that week."
          : b.data.payment_method === "membership_free" && attended
            ? " Free weekly class used for that week."
            : "";
      await onChange(
        attended
          ? `Marked ${b.data.member_name} present.${freeNote}`
          : `Marked ${b.data.member_name} absent.${freeNote}`
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update attendance", "err");
    } finally {
      setBusyId(null);
    }
  }

  async function setEventCheckIn(s: SiteRecord<SocialRegData>, checked: boolean) {
    setBusyId(s.id);
    try {
      await updateRecord<SocialRegData>("social_regs", s.id, { checked_in: checked });
      await onChange(
        checked
          ? `Checked in ${s.data.member_name}${s.data.plus_one_name ? ` + ${s.data.plus_one_name}` : ""}`
          : `Unchecked ${s.data.member_name}`
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update check-in", "err");
    } finally {
      setBusyId(null);
    }
  }

  if (selected) {
    const headCount =
      selected.kind === "class" ? selected.bookings.length : selected.regs.length;
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setSelectedKey(null)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
        >
          <ArrowLeft size={16} /> All sessions & events
        </button>

        <div className="card-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  selected.kind === "class"
                    ? "bg-white/10 text-muted"
                    : "bg-accent/15 text-accent"
                }`}
              >
                {selected.kind === "class" ? "Class" : "Event"}
              </span>
              <h2 className="mt-2 font-display text-3xl tracking-wide text-cream">
                {selected.title}
              </h2>
              <p className="mt-2 flex flex-wrap gap-3 text-sm text-muted">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={14} className="text-accent" />
                  {selected.date ? formatDateUK(selected.date) : "Date TBC"}
                  {selected.time ? ` · ${selected.time}` : ""}
                </span>
                {selected.venue && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} className="text-accent" />
                    {selected.venue}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Users size={14} className="text-accent" />
                  {headCount} booked
                </span>
              </p>
            </div>
          </div>
          {selected.kind === "class" && (
            <p className="mt-3 text-xs text-muted">
              Tick present when they arrive. For free member classes, unticked / absent after the
              session returns their free weekly class for that week.
            </p>
          )}
        </div>

        <div className="space-y-2">
          {selected.kind === "class" &&
            selected.bookings
              .slice()
              .sort((a, b) => a.data.member_name.localeCompare(b.data.member_name))
              .map((b) => {
                const present =
                  b.data.attended === true || b.data.record_status === "attended";
                const freeUsed = membershipFreeBookingCountsAsUsed(b);
                return (
                  <label
                    key={b.id}
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${
                      present
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-line bg-bg-card hover:border-accent/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-emerald-500"
                      checked={present}
                      disabled={busyId === b.id}
                      onChange={(e) => setClassAttendance(b, e.target.checked)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-cream">{b.data.member_name}</p>
                      <p className="truncate text-xs text-muted">{b.data.member_email}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-full bg-white/8 px-2 py-0.5">
                          {b.data.payment_method === "membership_free"
                            ? "Free member class"
                            : b.data.payment_method === "paypal"
                              ? "PayPal / card"
                              : b.data.payment_method === "pay_at_class" ||
                                  b.data.payment_status === "pay_at_class"
                                ? "Pay at class"
                                : b.data.payment_method || b.data.payment_status}
                        </span>
                        <span className="rounded-full bg-white/8 px-2 py-0.5">
                          £{Number(b.data.amount_gbp).toFixed(2)} · {b.data.payment_status}
                        </span>
                        {b.data.payment_method === "membership_free" && (
                          <span
                            className={`rounded-full px-2 py-0.5 ${
                              freeUsed
                                ? "bg-accent/15 text-accent"
                                : "bg-emerald-500/15 text-emerald-300"
                            }`}
                          >
                            {freeUsed ? "Free weekly used" : "Free weekly available"}
                          </span>
                        )}
                      </div>
                    </div>
                    {present && <Check className="shrink-0 text-emerald-400" size={20} />}
                  </label>
                );
              })}

          {selected.kind === "event" &&
            selected.regs
              .slice()
              .sort((a, b) => a.data.member_name.localeCompare(b.data.member_name))
              .map((s) => {
                const inDoor = !!s.data.checked_in;
                return (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${
                      inDoor
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-line bg-bg-card hover:border-accent/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-emerald-500"
                      checked={inDoor}
                      disabled={busyId === s.id}
                      onChange={(e) => setEventCheckIn(s, e.target.checked)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-cream">{s.data.member_name}</p>
                      <p className="truncate text-xs text-muted">{s.data.member_email}</p>
                      {s.data.plus_one_name && (
                        <p className="mt-0.5 text-xs text-accent">
                          +1: {s.data.plus_one_name}
                          {s.data.plus_one_email ? ` · ${s.data.plus_one_email}` : ""}
                          {s.data.plus_one_first_timer ? " · first-timer free" : " · paid guest"}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-full bg-white/8 px-2 py-0.5">
                          {(s.data.ticket_type || "").replaceAll("_", " ")}
                        </span>
                        <span className="rounded-full bg-white/8 px-2 py-0.5">
                          £{Number(s.data.amount_gbp).toFixed(2)} · {s.data.payment_status}
                          {s.data.payment_method ? ` · ${s.data.payment_method}` : ""}
                        </span>
                      </div>
                    </div>
                    {inDoor && <Check className="shrink-0 text-emerald-400" size={20} />}
                  </label>
                );
              })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl tracking-wide">Bookings & attendance</h2>
        <p className="mt-1 text-sm text-muted">
          Open a class session or event to mark attendance. Free weekly classes are only “used”
          when the member is marked present (or the session is still upcoming).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["all", "All"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide ${
              filter === id ? "bg-accent text-bg" : "border border-line text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.length === 0 && (
          <p className="text-sm text-muted sm:col-span-2 lg:col-span-3">
            No {filter === "all" ? "" : filter + " "}sessions with bookings.
          </p>
        )}
        {groups.map((g) => {
          const count = g.kind === "class" ? g.bookings.length : g.regs.length;
          const present =
            g.kind === "class"
              ? g.bookings.filter(
                  (b) => b.data.attended === true || b.data.record_status === "attended"
                ).length
              : g.regs.filter((r) => r.data.checked_in).length;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setSelectedKey(g.key)}
              className="card-surface p-5 text-left transition hover:border-accent/40"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  g.kind === "class" ? "bg-white/10 text-muted" : "bg-accent/15 text-accent"
                }`}
              >
                {g.kind === "class" ? "Class" : "Event"}
              </span>
              <p className="mt-2 font-display text-xl tracking-wide text-cream">{g.title}</p>
              <p className="mt-1 text-sm text-muted">
                {g.date ? formatDateUK(g.date) : "Date TBC"}
                {g.time ? ` · ${g.time}` : ""}
              </p>
              {g.venue && <p className="mt-0.5 text-xs text-muted">{g.venue}</p>}
              <p className="mt-3 text-sm">
                <strong className="text-accent">{count}</strong>
                <span className="text-muted"> booked</span>
                {count > 0 && (
                  <span className="text-muted">
                    {" "}
                    · <strong className="text-cream">{present}</strong> checked in
                  </span>
                )}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
