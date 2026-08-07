"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  LogOut,
  MessageCircle,
  Ticket,
  Users,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { CLASSES, SITE, SUBSCRIPTION_PLAN, VENUES } from "@/lib/data";
import { formatDateUK } from "@/lib/dates";
import { fileToAvatarDataUrl } from "@/lib/images";
import {
  assertPlusOneAvailable,
  loadEventById,
  pricingAfterPlusOneChange,
  validateFirstTimerGuest,
} from "@/lib/events";
import {
  convertFreeBookingsAfterBenefits,
  dayAfterISO,
  endOfMonthISO,
  hasMembershipBenefits,
  membershipFreeBookingCountsAsUsed,
} from "@/lib/membership";
import { upcomingSessions, weekBoundsForDate } from "@/lib/schedule";
import {
  listRecords,
  updateRecord,
  type BookingData,
  type MemberData,
  type SocialRegData,
  type SubscriptionData,
  type SiteRecord,
} from "@/lib/sitedata";

type StudioTab =
  | "overview"
  | "bookings"
  | "membership"
  | "guests"
  | "classes";

export default function AccountPage() {
  const { user, loading, logout, refreshUser, updateProfile } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<StudioTab>("overview");
  const [bookings, setBookings] = useState<{ id: string; data: BookingData }[]>([]);
  const [socials, setSocials] = useState<{ id: string; data: SocialRegData }[]>([]);
  const [subs, setSubs] = useState<{ id: string; data: SubscriptionData }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState<string | null>(null);
  /** Which social reg is being edited for +1 */
  const [editingPlusId, setEditingPlusId] = useState<string | null>(null);
  const [plusName, setPlusName] = useState("");
  const [plusEmail, setPlusEmail] = useState("");
  const [plusFirst, setPlusFirst] = useState(true);
  const [plusErr, setPlusErr] = useState<string | null>(null);

  async function onAvatarFile(file: File | null) {
    if (!file || !user) return;
    setAvatarBusy(true);
    setAvatarErr(null);
    setMsg(null);
    try {
      const url = await fileToAvatarDataUrl(file);
      await updateProfile({ avatar_url: url });
      setMsg("Profile photo updated — it’ll show in Community chat too.");
    } catch (e) {
      setAvatarErr(e instanceof Error ? e.message : "Could not update photo");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function clearAvatar() {
    if (!user) return;
    setAvatarBusy(true);
    setAvatarErr(null);
    try {
      await updateProfile({ avatar_url: "" });
      setMsg("Profile photo removed.");
    } catch (e) {
      setAvatarErr(e instanceof Error ? e.message : "Could not remove photo");
    } finally {
      setAvatarBusy(false);
    }
  }

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

  // Leave guest tab if membership benefits ended
  useEffect(() => {
    if (tab === "guests" && !benefitsActive) {
      setTab("overview");
    }
  }, [tab, benefitsActive]);

  const freeThisWeek = useMemo(() => {
    if (!user || !benefitsActive) return null;
    const { start, end } = weekBoundsForDate(new Date().toISOString().slice(0, 10));
    const used = bookings.filter((b) => {
      if (b.data.payment_method !== "membership_free") return false;
      const d = new Date(b.data.session_date + "T12:00:00");
      if (!(d >= start && d < end)) return false;
      return membershipFreeBookingCountsAsUsed(b);
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

  async function cancelEventReg(id: string) {
    if (!confirm("Cancel this event registration?")) return;
    setBusy(true);
    try {
      await updateRecord<SocialRegData>("social_regs", id, { record_status: "cancelled" });
      setMsg("Event registration cancelled.");
      setEditingPlusId(null);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not cancel event");
    } finally {
      setBusy(false);
    }
  }

  function startEditPlus(reg: SiteRecord<SocialRegData>) {
    setEditingPlusId(reg.id);
    setPlusName(reg.data.plus_one_name || "");
    setPlusEmail(reg.data.plus_one_email || "");
    setPlusFirst(reg.data.plus_one_first_timer !== false);
    setPlusErr(null);
  }

  async function savePlusOne(regId: string) {
    if (!user) return;
    setPlusErr(null);
    const name = plusName.trim();
    const email = plusEmail.trim().toLowerCase();

      const reg = socials.find((s) => s.id === regId);
    if (!reg) {
      setPlusErr("Registration not found.");
      return;
    }

    // Clear +1 entirely — drop paid guest fee back to free member entry
    if (!name && !email) {
      setBusy(true);
      try {
        const event = await loadEventById(reg.data.event_id);
        const pricing = pricingAfterPlusOneChange({
          event,
          isSubscriber: hasMembershipBenefits(user.subscription_status, user.period_end),
          hasPlus: false,
          plusFirstTimer: false,
        });
        await updateRecord<SocialRegData>("social_regs", regId, {
          plus_one_name: "",
          plus_one_email: "",
          plus_one_first_timer: false,
          amount_gbp: pricing.amount_gbp,
          ticket_type: pricing.ticket_type,
          payment_status: pricing.payment_status,
          payment_method: pricing.payment_method,
        });
        setMsg("Guest removed. Any paid +1 fee has been cleared from this registration.");
        setEditingPlusId(null);
        await reload();
      } catch (e) {
        setPlusErr(e instanceof Error ? e.message : "Could not update guest");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!name) {
      setPlusErr("Enter your +1’s full name (or clear both fields to remove them).");
      return;
    }
    if (!email || !email.includes("@")) {
      setPlusErr("Enter a valid email for your +1.");
      return;
    }

    setBusy(true);
    try {
      const allRegs = await listRecords<SocialRegData>("social_regs", 400);
      if (plusFirst) {
        // Free guest: never attended a BnB class or event (as dancer or +1)
        const check = await validateFirstTimerGuest(email, { allowRegId: regId });
        if (!check.ok) throw new Error(check.reason);
      } else {
        const check = assertPlusOneAvailable(allRegs, email, { allowRegId: regId });
        if (!check.ok) throw new Error(check.reason);
      }

      const event = await loadEventById(reg.data.event_id);
      const pricing = pricingAfterPlusOneChange({
        event,
        isSubscriber: hasMembershipBenefits(user.subscription_status, user.period_end),
        hasPlus: true,
        plusFirstTimer: plusFirst,
      });

      // Keep PayPal "paid" only if they already settled at least this guest amount online
      const alreadyPaidGuest =
        reg.data.payment_status === "paid" &&
        reg.data.payment_method === "paypal" &&
        Number(reg.data.amount_gbp) >= pricing.amount_gbp &&
        pricing.amount_gbp > 0 &&
        !plusFirst;

      await updateRecord<SocialRegData>("social_regs", regId, {
        plus_one_name: name,
        plus_one_email: email,
        plus_one_first_timer: plusFirst,
        amount_gbp: pricing.amount_gbp,
        ticket_type: pricing.ticket_type,
        payment_status: alreadyPaidGuest ? "paid" : pricing.payment_status,
        payment_method: alreadyPaidGuest ? "paypal" : pricing.payment_method,
      });

      if (pricing.guestFee > 0 && !alreadyPaidGuest) {
        setMsg(
          `Guest saved. £${pricing.guestFee.toFixed(2)} paid +1 fee added — pay at the door (or open the event page to pay online).`
        );
      } else if (plusFirst) {
        setMsg("Guest saved as free first-timer +1 (no extra fee).");
      } else {
        setMsg("Guest details saved.");
      }
      setEditingPlusId(null);
      await reload();
    } catch (e) {
      setPlusErr(e instanceof Error ? e.message : "Could not save guest");
    } finally {
      setBusy(false);
    }
  }

  /** Cancel at end of paid month — keep benefits until period_end */
  async function cancelMembershipEndOfMonth() {
    if (!user) return;
    const periodEnd = endOfMonthISO();
    const chargeFrom = dayAfterISO(periodEnd);
    if (
      !confirm(
        `Cancel membership at month end?\n\n` +
          `• You keep free weekly classes, socials, +1 and community until ${formatDateUK(periodEnd)}.\n` +
          `• Free class bookings on or after ${formatDateUK(chargeFrom)} become pay-at-class (£${SITE.classPrice}).\n` +
          `• There is no refund — this only stops renewal and schedules benefits to end.\n` +
          `• Prefer to stop perks today? Use “Cancel immediately” instead.`
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

  /**
   * End benefits immediately (no refund). Same money outcome as month-end cancel —
   * only the benefit window differs.
   */
  async function cancelMembershipImmediately() {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    if (
      !confirm(
        `Cancel membership immediately?\n\n` +
          `• Free classes, social +1 and community chat end today.\n` +
          `• Free class bookings from today onwards become pay-at-class (£${SITE.classPrice}).\n` +
          `• There is no refund and no money difference vs cancelling at month end — this only ends benefits now if you prefer.\n` +
          `• To keep benefits until month end, cancel that option instead.`
      )
    )
      return;
    setBusy(true);
    try {
      const active = subs.filter(
        (s) =>
          s.data.record_status === "active" ||
          s.data.record_status === "pending_cash" ||
          s.data.record_status === "cancelling"
      );
      for (const s of active) {
        await updateRecord<SubscriptionData>("subscriptions", s.id, {
          record_status: "cancelled",
          cancelled_at: new Date().toISOString(),
          period_end: today,
        });
      }
      await updateRecord<MemberData>("members", user.id, {
        subscription_status: "cancelled",
        period_end: today,
        chat_joined: false,
      });

      const { converted } = await convertFreeBookingsAfterBenefits({
        memberId: user.id,
        memberEmail: user.email,
        chargeFromDate: today,
      });

      await refreshUser();
      if (tab === "guests") setTab("overview");
      setMsg(
        `Membership cancelled immediately — benefits ended today.` +
          (converted > 0
            ? ` ${converted} free class booking${converted === 1 ? "" : "s"} ${converted === 1 ? "is" : "are"} now pay-at-class (£${SITE.classPrice}).`
            : "") +
          " You can resubscribe anytime from Membership."
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

  const isSubscriber = benefitsActive || user.role === "admin";
  // +1 guests is a membership perk (active / still in paid cancel period)
  const showSubscriberPerks = benefitsActive;

  const tabs: { id: StudioTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "bookings", label: "My bookings" },
    { id: "membership", label: "Membership" },
    ...(showSubscriberPerks ? [{ id: "guests" as const, label: "+1 guests" }] : []),
    { id: "classes", label: "Class times" },
  ];

  return (
    <section className="container-page py-24 md:py-28">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <UserAvatar name={user.name} src={user.avatar_url} size={72} ring />
          <div className="min-w-0">
            <p className="section-label">Dancer studio</p>
            <h1 className="mt-2 font-display text-4xl tracking-wide md:text-5xl">{user.name}</h1>
            <p className="mt-2 text-muted">
              {user.email} · {user.role === "admin" ? "Admin" : "Dancer"}
            </p>
          </div>
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
        {/* Subscriber (+ admin) only — full-screen community chat */}
        {isSubscriber && (
          <Link
            href="/community/"
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-accent transition hover:bg-accent hover:text-bg"
          >
            <MessageCircle size={14} />
            Community
          </Link>
        )}
      </div>

      {tab === "overview" && (
        <div className="mt-8 space-y-6">
          <div className="card-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <UserAvatar name={user.name} src={user.avatar_url} size={88} ring />
              <div>
                <h2 className="font-display text-2xl tracking-wide">Profile photo</h2>
                <p className="mt-1 max-w-md text-sm text-muted">
                  Shown on your dancer studio and in Community chat when you’re a member. Square
                  photos work best.
                </p>
                {avatarErr && <p className="mt-2 text-sm text-red-400">{avatarErr}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={`btn-primary !cursor-pointer !py-2 text-sm ${
                  avatarBusy ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {avatarBusy ? "Saving…" : user.avatar_url ? "Change photo" : "Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={avatarBusy}
                  onChange={(e) => onAvatarFile(e.target.files?.[0] || null)}
                />
              </label>
              {user.avatar_url && (
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={clearAvatar}
                  className="btn-secondary !py-2 text-sm disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="card-surface space-y-3 p-5">
            <h2 className="font-display text-2xl tracking-wide">Email preferences</h2>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--color-accent)]"
                checked={!!user.mailing_list_opt_in}
                disabled={busy}
                onChange={async (e) => {
                  setBusy(true);
                  setMsg(null);
                  try {
                    await updateProfile({ mailing_list_opt_in: e.target.checked });
                    setMsg(
                      e.target.checked
                        ? "You’re on the general mailing list."
                        : "You’ve left the general mailing list."
                    );
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Could not update preference");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <span>
                <span className="font-semibold text-cream">General mailing list</span>
                <span className="mt-1 block text-muted">
                  News, tips and event announcements. Separate from membership emails.
                </span>
              </span>
            </label>
            {benefitsActive && (
              <p className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-xs text-cream">
                You’re also on the <strong>subscriber list</strong> automatically while your
                membership benefits are active (class updates, member-only notices).
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="card-surface p-5">
              <p className="text-sm text-muted">Membership</p>
              <p className="mt-2 font-display text-3xl text-accent">
                {user.subscription_status === "cancelling"
                  ? `Cancelling (until ${user.period_end ? formatDateUK(user.period_end) : "end of month"})`
                  : user.subscription_status === "active"
                    ? "Active"
                    : user.subscription_status === "cancelled"
                      ? "Cancelled"
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
              <p className="mt-2 font-display text-3xl">
                {bookings.filter((b) => b.data.record_status !== "cancelled").length +
                  socials.filter((s) => s.data.record_status !== "cancelled").length}
              </p>
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
            {isSubscriber && (
              <Link
                href="/community/"
                className="card-surface flex items-center gap-3 p-5 transition hover:border-accent/40"
              >
                <MessageCircle className="text-accent" size={22} />
                <span className="font-semibold text-cream">Community chat</span>
              </Link>
            )}
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
        <div className="mt-8 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl tracking-wide">Your bookings</h2>
              <p className="mt-1 text-sm text-muted">
                Classes and events you’ve registered for. Manage guests under +1 guests.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary !py-2 text-sm"
                onClick={() => reload()}
              >
                Refresh
              </button>
              <Link href="/book/" className="btn-primary !py-2 text-sm">
                Book a class
              </Link>
              <Link href="/events/" className="btn-secondary !py-2 text-sm">
                Browse events
              </Link>
            </div>
          </div>

          {/* ── Classes ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
              Classes (
              {bookings.filter((b) => b.data.record_status !== "cancelled").length} active)
            </h3>
            {bookings.filter((b) => b.data.record_status !== "cancelled").length === 0 && (
              <p className="text-sm text-muted">No active class bookings.</p>
            )}
            {bookings
              .filter((b) => b.data.record_status !== "cancelled")
              .slice()
              .sort((a, b) => b.data.session_date.localeCompare(a.data.session_date))
              .map((b) => (
                <div
                  key={b.id}
                  className="card-surface flex flex-wrap items-start justify-between gap-4 p-5 text-sm"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                        Class
                      </span>
                      <span className="font-semibold text-cream">{b.data.class_title}</span>
                    </div>
                    <div className="mt-1 text-muted">
                      {formatDateUK(b.data.session_date)} · {b.data.session_time}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
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
          </div>

          {/* ── Events ── */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">
              Events (
              {socials.filter((s) => s.data.record_status !== "cancelled").length} active)
            </h3>
            {socials.filter((s) => s.data.record_status !== "cancelled").length === 0 && (
              <p className="text-sm text-muted">
                No event registrations yet.{" "}
                <Link href="/events/" className="font-semibold text-accent hover:underline">
                  Browse events
                </Link>
              </p>
            )}
            {socials
              .filter((s) => s.data.record_status !== "cancelled")
              .map((s) => (
                <div
                  key={s.id}
                  className="card-surface flex flex-wrap items-start justify-between gap-4 p-5 text-sm"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                        Event
                      </span>
                      <span className="font-semibold text-cream">{s.data.event_title}</span>
                    </div>
                    <div className="mt-1 text-muted">
                      {(s.data.ticket_type || "").replaceAll("_", " ")}
                      {s.data.plus_one_name ? ` · +1: ${s.data.plus_one_name}` : ""}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white/8 px-2 py-0.5">
                        {s.data.payment_status}
                      </span>
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-accent">
                        £{Number(s.data.amount_gbp).toFixed(2)}
                        {s.data.payment_method ? ` · ${s.data.payment_method}` : ""}
                      </span>
                      {s.data.checked_in && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                          Checked in
                        </span>
                      )}
                    </div>
                    {benefitsActive && (
                      <p className="mt-2 text-xs text-muted">
                        Manage / change your +1 in the{" "}
                        <button
                          type="button"
                          className="font-semibold text-accent hover:underline"
                          onClick={() => setTab("guests")}
                        >
                          +1 guests
                        </button>{" "}
                        tab.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Link
                      href={`/events/${s.data.event_id}/`}
                      className="text-xs font-bold text-accent hover:underline"
                    >
                      Event page →
                    </Link>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => cancelEventReg(s.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-red-400"
                    >
                      <XCircle size={14} /> Cancel
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {/* Cancelled */}
          {(bookings.some((b) => b.data.record_status === "cancelled") ||
            socials.some((s) => s.data.record_status === "cancelled")) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">
                Cancelled
              </h3>
              {bookings
                .filter((b) => b.data.record_status === "cancelled")
                .map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl border border-red-500/40 bg-red-950/40 p-5 text-sm opacity-90"
                  >
                    <div className="font-semibold text-red-300 line-through">
                      Class · {b.data.class_title}
                    </div>
                    <div className="text-red-200/70">
                      {formatDateUK(b.data.session_date)} · {b.data.session_time}
                    </div>
                  </div>
                ))}
              {socials
                .filter((s) => s.data.record_status === "cancelled")
                .map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-red-500/40 bg-red-950/40 p-5 text-sm opacity-90"
                  >
                    <div className="font-semibold text-red-300 line-through">
                      Event · {s.data.event_title}
                    </div>
                    <div className="text-red-200/70">
                      {(s.data.ticket_type || "").replaceAll("_", " ")}
                    </div>
                  </div>
                ))}
            </div>
          )}
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
              {user.subscription_status === "cancelled" && (
                <> · ended{user.period_end ? ` ${formatDateUK(user.period_end)}` : ""}</>
              )}
              {freeThisWeek && benefitsActive && (
                <> · Free classes this week: {freeThisWeek.remaining} remaining</>
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {!benefitsActive && user.subscription_status !== "pending_cash" ? (
                <Link
                  href="/subscribe/"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                >
                  Subscribe
                </Link>
              ) : (
                <>
                  {benefitsActive && (
                    <Link href="/book/" className="btn-primary">
                      Book free weekly class
                    </Link>
                  )}
                  {(user.subscription_status === "active" ||
                    user.subscription_status === "cancelling") && (
                    <>
                      {user.subscription_status === "active" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={cancelMembershipEndOfMonth}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-red-500/50 bg-red-500/15 px-5 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
                        >
                          Cancel at month end
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={cancelMembershipImmediately}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:bg-red-500 disabled:opacity-50"
                      >
                        Cancel immediately
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
            {(user.subscription_status === "active" ||
              user.subscription_status === "cancelling") && (
              <p className="mt-4 text-xs text-muted">
                Cancel options don’t change what you’ve already paid — choose month end to keep
                benefits until then, or cancel immediately to end free classes, +1 guests and
                community today.
              </p>
            )}
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

      {tab === "guests" && showSubscriberPerks && (
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl tracking-wide">+1 guests</h2>
            <Link href="/events/" className="btn-secondary !py-2 text-sm">
              <UserPlus size={16} /> Browse events
            </Link>
          </div>
          <p className="text-sm text-muted">
            Add, edit or replace your free first-timer +1 (or paid guest) for events you’re
            registered on. Each guest email can only be used as a +1 once across all events.
          </p>
          {socials.filter((s) => s.data.record_status !== "cancelled").length === 0 && (
            <p className="text-sm text-muted">
              No event registrations yet.{" "}
              <Link href="/events/" className="font-semibold text-accent hover:underline">
                Book an event
              </Link>{" "}
              first, then manage your +1 here.
            </p>
          )}
          {socials
            .filter((s) => s.data.record_status !== "cancelled")
            .map((s) => {
              const editing = editingPlusId === s.id;
              return (
                <div key={s.id} className="card-surface space-y-3 p-5 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-cream">{s.data.event_title}</div>
                      <div className="text-muted">
                        {(s.data.ticket_type || "").replaceAll("_", " ")}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        £{Number(s.data.amount_gbp).toFixed(2)} · {s.data.record_status}
                        {s.data.checked_in ? " · checked in" : ""}
                      </div>
                    </div>
                    <Link
                      href={`/events/${s.data.event_id}/`}
                      className="text-xs font-bold text-accent hover:underline"
                    >
                      Event page →
                    </Link>
                  </div>

                  {!editing && (
                    <>
                      {s.data.plus_one_name ? (
                        <div className="rounded-lg border border-accent/25 bg-accent/10 px-3 py-2 text-accent">
                          <span className="font-semibold">+1:</span> {s.data.plus_one_name}
                          {s.data.plus_one_email ? ` · ${s.data.plus_one_email}` : ""}
                          {s.data.plus_one_first_timer ? " · first-timer free" : " · paid / returning guest"}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-line bg-bg/40 px-3 py-2 text-muted">
                          No +1 on this registration yet
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn-secondary !py-1.5 text-xs"
                        onClick={() => startEditPlus(s)}
                      >
                        {s.data.plus_one_name ? "Edit / change +1" : "Add a +1"}
                      </button>
                    </>
                  )}

                  {editing && (
                    <div className="space-y-3 rounded-xl border border-line bg-bg/50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted">
                        {s.data.plus_one_name ? "Edit guest" : "Add guest"}
                      </p>
                      <label className="block text-xs font-semibold text-cream">
                        Full name
                        <input
                          value={plusName}
                          onChange={(e) => setPlusName(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm font-normal"
                          placeholder="Guest name"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-cream">
                        Email
                        <input
                          type="email"
                          value={plusEmail}
                          onChange={(e) => setPlusEmail(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm font-normal"
                          placeholder="guest@email.com"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={plusFirst}
                          onChange={(e) => setPlusFirst(e.target.checked)}
                          className="accent-[var(--color-accent)]"
                        />
                        They have never been to a Boots N Boogie class or event before (free guest)
                      </label>
                      {!plusFirst && (
                        <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-cream">
                          Paid guest: the lowest ticket price for this event will be added to your
                          registration (pay at the door). Your member entry stays free.
                        </p>
                      )}
                      <p className="text-[11px] text-muted">
                        Clear name and email, then save, to remove this +1 (and any paid guest fee).
                        A guest email can only be used as a +1 once.
                      </p>
                      {plusErr && <p className="text-xs text-red-400">{plusErr}</p>}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => savePlusOne(s.id)}
                          className="btn-primary !py-1.5 text-xs disabled:opacity-50"
                        >
                          {busy ? "Saving…" : "Save +1"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingPlusId(null);
                            setPlusErr(null);
                          }}
                          className="btn-secondary !py-1.5 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
