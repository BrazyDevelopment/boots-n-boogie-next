"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  LogOut,
  MessageCircle,
  Ticket,
  Users,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { CommunityChat } from "@/components/CommunityChat";
import { CLASSES, SITE, SUBSCRIPTION_PLAN, VENUES } from "@/lib/data";
import { formatDateUK } from "@/lib/dates";
import {
  convertFreeBookingsAfterBenefits,
  dayAfterISO,
  endOfMonthISO,
  hasMembershipBenefits,
} from "@/lib/membership";
import { upcomingSessions, weekBoundsForDate } from "@/lib/schedule";
import {
  listRecords,
  updateRecord,
  type BookingData,
  type MemberData,
  type SocialRegData,
  type SubscriptionData,
} from "@/lib/sitedata";

type StudioTab =
  | "overview"
  | "bookings"
  | "membership"
  | "community"
  | "guests"
  | "classes";

export default function AccountPage() {
  const { user, loading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<StudioTab>("overview");
  const [bookings, setBookings] = useState<{ id: string; data: BookingData }[]>([]);
  const [socials, setSocials] = useState<{ id: string; data: SocialRegData }[]>([]);
  const [subs, setSubs] = useState<{ id: string; data: SubscriptionData }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    if (!user) return;
    try {
      const [b, s, sub] = await Promise.all([
        listRecords<BookingData>("bookings", 200),
        listRecords<SocialRegData>("social_regs", 200),
        listRecords<SubscriptionData>("subscriptions", 200),
      ]);
      const email = user.email.toLowerCase();
      // Match by member id or email so bookings always show even if ids drift
      setBookings(
        b.filter(
          (x) =>
            x.data.member_id === user.id ||
            (x.data.member_email || "").toLowerCase() === email
        )
      );
      setSocials(
        s.filter(
          (x) =>
            x.data.member_id === user.id ||
            (x.data.member_email || "").toLowerCase() === email
        )
      );
      setSubs(
        sub.filter(
          (x) =>
            x.data.member_id === user.id ||
            (x.data.member_email || "").toLowerCase() === email
        )
      );
      setMsg(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not load studio data");
    }
  }

  useEffect(() => {
    if (!loading && !user) router.replace("/account/login/?next=/account/");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) reload().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Refresh when returning to this tab / visibility change
  useEffect(() => {
    const onFocus = () => {
      if (user) reload().catch(console.error);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const upcoming = useMemo(() => upcomingSessions(4).slice(0, 6), []);

  const benefitsActive = hasMembershipBenefits(user?.subscription_status, user?.period_end);

  const freeThisWeek = useMemo(() => {
    if (!user || !benefitsActive) return null;
    const { start, end } = weekBoundsForDate(new Date().toISOString().slice(0, 10));
    const used = bookings.filter((b) => {
      if (b.data.payment_method !== "membership_free") return false;
      if (b.data.record_status === "cancelled") return false;
      const d = new Date(b.data.session_date + "T12:00:00");
      return d >= start && d < end;
    }).length;
    return {
      used,
      remaining: Math.max(0, SUBSCRIPTION_PLAN.freeSessionsPerWeek - used),
    };
  }, [bookings, user, benefitsActive]);

  async function cancelBooking(id: string) {
    if (!confirm("Cancel this booking?")) return;
    setBusy(true);
    try {
      await updateRecord<BookingData>("bookings", id, { record_status: "cancelled" });
      setMsg("Booking cancelled — it now appears in the red cancelled section.");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  }

  async function cancelMembership() {
    if (!user) return;
    const periodEnd = endOfMonthISO();
    // Free classes after the paid month become full-price drop-ins
    const chargeFrom = dayAfterISO(periodEnd);
    if (
      !confirm(
        `Cancel membership?\n\n` +
          `• You keep free weekly classes and social benefits until ${formatDateUK(periodEnd)} (end of the month you’ve paid for).\n` +
          `• Any free member class bookings on or after ${formatDateUK(chargeFrom)} will automatically become pay-at-class at the normal drop-in price (£${SITE.classPrice}).\n` +
          `• Free bookings still within the paid month stay free.`
      )
    )
      return;
    setBusy(true);
    try {
      const active = subs.filter(
        (s) => s.data.record_status === "active" || s.data.record_status === "pending_cash"
      );
      for (const s of active) {
        await updateRecord<SubscriptionData>("subscriptions", s.id, {
          record_status: "cancelling",
          cancelled_at: new Date().toISOString(),
          period_end: periodEnd,
        });
      }
      await updateRecord<MemberData>("members", user.id, {
        subscription_status: "cancelling",
        period_end: periodEnd,
      });

      const { converted } = await convertFreeBookingsAfterBenefits({
        memberId: user.id,
        memberEmail: user.email,
        chargeFromDate: chargeFrom,
      });

      await refreshUser();
      setMsg(
        `Membership set to cancel. Benefits continue until ${formatDateUK(periodEnd)}.` +
          (converted > 0
            ? ` ${converted} free class booking${converted === 1 ? "" : "s"} after that date ${converted === 1 ? "is" : "are"} now pay-at-class (£${SITE.classPrice}).`
            : " No further free bookings beyond that month.") +
          " No further monthly charges after that."
      );
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not cancel membership");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <section className="container-page py-36">
        <p className="text-muted">Loading dancer studio…</p>
      </section>
    );
  }

  const tabs: { id: StudioTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "bookings", label: "My bookings" },
    { id: "membership", label: "Membership" },
    { id: "community", label: "Community" },
    { id: "guests", label: "+1 guests" },
    { id: "classes", label: "Class times" },
  ];

  return (
    <section className="container-page py-24 md:py-28">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-label">Dancer studio</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide md:text-5xl">{user.name}</h1>
          <p className="mt-2 text-muted">
            {user.email} · {user.role === "admin" ? "Admin" : "Dancer"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === "admin" && (
            <Link href="/admin/" className="btn-primary !py-2 text-sm">
              Admin
            </Link>
          )}
          <Link href="/book/" className="btn-secondary !py-2 text-sm">
            <Ticket size={16} /> Book class
          </Link>
          <button type="button" onClick={logout} className="btn-secondary !py-2 text-sm">
            <LogOut size={16} /> Log out
          </button>
        </div>
      </div>

      {msg && <p className="mt-4 text-sm text-accent">{msg}</p>}

      <div className="mt-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide ${
              tab === t.id ? "bg-accent text-bg" : "border border-line bg-white/5 text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="card-surface p-5">
              <p className="text-sm text-muted">Membership</p>
              <p className="mt-2 font-display text-3xl text-accent">
                {user.subscription_status === "cancelling"
                ? `Cancelling (until ${user.period_end ? formatDateUK(user.period_end) : "end of month"})`
                : user.subscription_status === "active"
                  ? "Active"
                  : user.subscription_status || "None"}
              </p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-muted">Free class this week</p>
              <p className="mt-2 font-display text-3xl text-accent">
                {freeThisWeek ? `${freeThisWeek.remaining} left` : "—"}
              </p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-muted">Bookings</p>
              <p className="mt-2 font-display text-3xl">{bookings.length}</p>
            </div>
            <div className="card-surface p-5">
              <p className="text-sm text-muted">Social +1s</p>
              <p className="mt-2 font-display text-3xl">
                {socials.filter((s) => s.data.plus_one_name).length}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/book/"
              className="card-surface flex items-center gap-3 p-5 transition hover:border-accent/40"
            >
              <Ticket className="text-accent" size={22} />
              <span className="font-semibold text-cream">Book a class</span>
            </Link>
            <Link
              href="/subscribe/"
              className="card-surface flex items-center gap-3 p-5 transition hover:border-accent/40"
            >
              <CreditCard className="text-accent" size={22} />
              <span className="font-semibold text-cream">Membership options</span>
            </Link>
            <Link
              href="/community/"
              className="card-surface flex items-center gap-3 p-5 transition hover:border-accent/40"
            >
              <MessageCircle className="text-accent" size={22} />
              <span className="font-semibold text-cream">Community chat</span>
            </Link>
            <Link
              href="/events/"
              className="card-surface flex items-center gap-3 p-5 transition hover:border-accent/40"
            >
              <Users className="text-accent" size={22} />
              <span className="font-semibold text-cream">Socials & events</span>
            </Link>
            <Link
              href="/classes/"
              className="card-surface flex items-center gap-3 p-5 transition hover:border-accent/40"
            >
              <CalendarDays className="text-accent" size={22} />
              <span className="font-semibold text-cream">Class info</span>
            </Link>
          </div>

          <div>
            <h2 className="font-display text-2xl tracking-wide">Coming up</h2>
            <div className="mt-4 space-y-2">
              {upcoming.map((s) => (
                <div key={s.key} className="card-surface flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <div className="font-semibold text-cream">{s.title}</div>
                    <div className="text-muted">{s.label}</div>
                  </div>
                  <Link href={`/book/?class=${s.classId}`} className="text-xs font-bold text-accent">
                    Book →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "bookings" && (
        <div className="mt-8 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl tracking-wide">Your class bookings</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary !py-2 text-sm"
                onClick={() => reload()}
              >
                Refresh
              </button>
              <Link href="/book/" className="btn-primary !py-2 text-sm">
                New booking
              </Link>
            </div>
          </div>
          {bookings.length === 0 && (
            <p className="text-sm text-muted">
              No bookings found for {user.email}. If you just booked, press Refresh.
            </p>
          )}
          {(() => {
            const sorted = bookings
              .slice()
              .sort((a, b) => b.data.session_date.localeCompare(a.data.session_date));
            const active = sorted.filter((b) => b.data.record_status !== "cancelled");
            const cancelled = sorted.filter((b) => b.data.record_status === "cancelled");
            return (
              <>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
                  Active bookings ({active.length})
                </h3>
                {active.length === 0 && (
                  <p className="text-sm text-muted">No active bookings.</p>
                )}
                {active.map((b) => (
                  <div
                    key={b.id}
                    className="card-surface flex flex-wrap items-start justify-between gap-4 p-5 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-cream">{b.data.class_title}</div>
                      <div className="text-muted">
                        {formatDateUK(b.data.session_date)} · {b.data.session_time}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/8 px-2 py-0.5">
                          {b.data.record_status}
                        </span>
                        <span className="rounded-full bg-white/8 px-2 py-0.5">
                          {b.data.payment_status}
                        </span>
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">
                          {b.data.payment_method === "membership_free"
                            ? "Free member class"
                            : b.data.payment_status === "pay_at_class"
                              ? `£${Number(b.data.amount_gbp).toFixed(2)} pay at class`
                              : `£${Number(b.data.amount_gbp).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => cancelBooking(b.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-400"
                    >
                      <XCircle size={14} /> Cancel
                    </button>
                  </div>
                ))}

                {cancelled.length > 0 && (
                  <>
                    <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-red-400">
                      Cancelled bookings ({cancelled.length})
                    </h3>
                    {cancelled.map((b) => (
                      <div
                        key={b.id}
                        className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-red-500/40 bg-red-950/40 p-5 text-sm opacity-90"
                      >
                        <div>
                          <div className="font-semibold text-red-300 line-through decoration-red-400/80">
                            {b.data.class_title}
                          </div>
                          <div className="text-red-200/70">
                            {formatDateUK(b.data.session_date)} · {b.data.session_time}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-bold uppercase text-red-300">
                              Cancelled
                            </span>
                            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-200/80">
                              {b.data.payment_method === "membership_free"
                                ? "Was free member class"
                                : `£${Number(b.data.amount_gbp).toFixed(2)}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}

      {tab === "community" && (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted">
            Prefer a full-screen chat app?{" "}
            <Link href="/community/" className="font-semibold text-accent hover:underline">
              Open Community
            </Link>{" "}
            then Add to Home Screen on your phone.
          </p>
          <CommunityChat />
        </div>
      )}

      {tab === "membership" && (
        <div className="mt-8 space-y-6">
          <div className="card-surface p-6">
            <h2 className="font-display text-2xl tracking-wide">£{SUBSCRIPTION_PLAN.amountGbp}/month membership</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {SUBSCRIPTION_PLAN.benefits.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-cream">
              Status:{" "}
              <strong className="text-accent">{user.subscription_status || "none"}</strong>
              {user.subscription_status === "cancelling" && user.period_end && (
                <> · benefits until {formatDateUK(user.period_end)}</>
              )}
              {freeThisWeek && benefitsActive && (
                <> · Free classes this week: {freeThisWeek.remaining} remaining</>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {!benefitsActive && user.subscription_status !== "pending_cash" ? (
                <Link href="/subscribe/" className="btn-primary">
                  Start membership
                </Link>
              ) : (
                <>
                  {benefitsActive && (
                    <Link href="/book/" className="btn-primary">
                      Book free weekly class
                    </Link>
                  )}
                  {user.subscription_status === "active" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={cancelMembership}
                      className="btn-secondary"
                    >
                      Cancel (keep benefits to month end)
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-display text-xl tracking-wide">Payment records</h3>
            <div className="mt-3 space-y-3">
              {subs.length === 0 && <p className="text-sm text-muted">No membership records yet.</p>}
              {subs.map((s) => (
                <div key={s.id} className="card-surface p-4 text-sm">
                  <div className="font-mono text-xs text-cream">{s.data.mandate_ref}</div>
                  <div className="mt-1 text-muted">
                    £{Number(s.data.amount_gbp).toFixed(2)}/mo · {s.data.record_status}
                  </div>
                  <div className="text-xs text-muted">
                    {s.data.account_name} · {s.data.sort_code}
                    {s.data.payment_method === "direct_debit" || s.data.account_number
                      ? ` · ****${(s.data.account_number || s.data.account_last4 || "").slice(-4)}`
                      : ""}
                    {s.data.payment_method ? ` · ${s.data.payment_method}` : ""}
                  </div>
                  {s.data.record_status === "pending_cash" && (
                    <p className="mt-2 text-xs text-accent">
                      Pay £{SUBSCRIPTION_PLAN.amountGbp} cash at {VENUES.arnoldHouse.name}. Free
                      classes unlock after admin activation.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "guests" && (
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl tracking-wide">Socials & +1 guests</h2>
            <Link href="/events/" className="btn-secondary !py-2 text-sm">
              <UserPlus size={16} /> Browse events
            </Link>
          </div>
          <p className="text-sm text-muted">
            Active members get free quarterly social entry and can bring a free +1. Register on the
            event page.
          </p>
          {socials.length === 0 && <p className="text-sm text-muted">No social registrations yet.</p>}
          {socials.map((s) => (
            <div key={s.id} className="card-surface p-5 text-sm">
              <div className="font-semibold text-cream">{s.data.event_title}</div>
              <div className="text-muted">{s.data.ticket_type.replaceAll("_", " ")}</div>
              {s.data.plus_one_name ? (
                <div className="mt-2 text-accent">
                  +1: {s.data.plus_one_name}
                  {s.data.plus_one_email ? ` · ${s.data.plus_one_email}` : ""}
                  {s.data.plus_one_first_timer ? " · first-timer free" : ""}
                </div>
              ) : (
                <div className="mt-2 text-muted">No +1 on this registration</div>
              )}
              <div className="mt-1 text-xs text-muted">
                £{Number(s.data.amount_gbp).toFixed(2)} · {s.data.record_status}
                {s.data.checked_in ? " · checked in" : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "classes" && (
        <div className="mt-8 space-y-4">
          <h2 className="font-display text-2xl tracking-wide">Where & when</h2>
          {CLASSES.map((c) => (
            <div key={c.id} className="card-surface p-5">
              <div className="font-display text-xl tracking-wide text-cream">{c.title}</div>
              <p className="mt-1 text-sm text-muted">{c.description}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {c.slots.map((slot) => {
                  const v = VENUES[slot.venueId];
                  const days = [
                    "Sundays",
                    "Mondays",
                    "Tuesdays",
                    "Wednesdays",
                    "Thursdays",
                    "Fridays",
                    "Saturdays",
                  ];
                  return (
                    <li key={`${slot.dayOfWeek}-${slot.time}`} className="rounded-lg border border-line p-3">
                      <strong className="text-accent">
                        {days[slot.dayOfWeek]} {slot.time}
                      </strong>
                      <div className="text-muted">
                        {v.name} · {v.address}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Link href={`/book/?class=${c.id}`} className="mt-4 inline-block text-sm font-bold text-accent">
                Book {c.level} →
              </Link>
            </div>
          ))}
          <p className="text-xs text-muted">
            Drop-in £{SITE.classPrice}. Members include 1 free class per week.
          </p>
        </div>
      )}
    </section>
  );
}
