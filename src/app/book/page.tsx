"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { PayPalCheckout } from "@/components/PayPalButtons";
import { useAuth } from "@/context/AuthContext";
import { BLACKOUT_NOTE } from "@/lib/blackouts";
import { CLASSES, SITE, SUBSCRIPTION_PLAN } from "@/lib/data";
import { formatDateUK } from "@/lib/dates";
import { hasMembershipBenefits } from "@/lib/membership";
import {
  upcomingSessions,
  upcomingSessionsFromSlots,
  weekBoundsForDate,
  type ClassSession,
} from "@/lib/schedule";
import {
  parseJsonSafe,
  type FranchiseClassSlot,
  type FranchiseeData,
  type HqLocationBody,
} from "@/lib/cms-types";
import { createRecord, listRecords, type BookingData, type CmsContentData } from "@/lib/sitedata";

type PayChoice = "" | "pay_at_class" | "paypal";

function BookForm() {
  const params = useSearchParams();
  const preselect = params.get("class") || "";
  const franchiseeId = params.get("franchisee") || "";
  const hqLocationId = params.get("location") || "";
  const franchiseeTown = params.get("town") || "";
  const venueOverride = params.get("venue") || "";
  const { user, siteDataReady, siteDataError } = useAuth();
  const [cancelledKeys, setCancelledKeys] = useState<Set<string>>(new Set());
  const [remoteSlots, setRemoteSlots] = useState<FranchiseClassSlot[] | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [classFilter, setClassFilter] = useState(preselect);
  const [sessionKey, setSessionKey] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PayChoice>("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [doneAmount, setDoneAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [freeAvailable, setFreeAvailable] = useState(false);
  const [checkingFree, setCheckingFree] = useState(false);

  const isRemoteLocation = !!(hqLocationId || franchiseeId);

  const sessions: ClassSession[] = useMemo(() => {
    if (isRemoteLocation && remoteSlots) {
      return upcomingSessionsFromSlots(
        remoteSlots,
        8,
        cancelledKeys,
        hqLocationId ? `hq_${hqLocationId}` : `fr_${franchiseeId}`
      );
    }
    if (isRemoteLocation && remoteSlots === null) {
      return []; // still loading remote schedule
    }
    return upcomingSessions(8, cancelledKeys);
  }, [isRemoteLocation, remoteSlots, cancelledKeys, hqLocationId, franchiseeId]);

  const filtered = classFilter
    ? sessions.filter((s) => s.classId === classFilter)
    : sessions;

  const classFilters = useMemo(() => {
    type FilterChip = { id: string; label: string };
    if (!isRemoteLocation || !remoteSlots) {
      return CLASSES.map((c) => ({ id: c.id, label: c.level }));
    }
    const seen = new Set<string>();
    const chips: FilterChip[] = [];
    for (const s of remoteSlots) {
      if (seen.has(s.classId)) continue;
      seen.add(s.classId);
      const staticCls = CLASSES.find((c) => c.id === s.classId);
      chips.push({ id: s.classId, label: staticCls?.level || s.level || s.title });
    }
    return chips;
  }, [isRemoteLocation, remoteSlots]);

  const selected = sessions.find((s) => s.key === sessionKey);
  const isMember = hasMembershipBenefits(user?.subscription_status, user?.period_end);

  const checkFreeForSession = useCallback(
    async (sessionDate: string) => {
      if (!user || !hasMembershipBenefits(user.subscription_status, user.period_end)) {
        setFreeAvailable(false);
        return false;
      }
      setCheckingFree(true);
      try {
        const bookings = await listRecords<BookingData>("bookings", 200);
        const { start, end } = weekBoundsForDate(sessionDate);
        const freeUsed = bookings.filter((b) => {
          if (b.data.member_id !== user.id && b.data.member_email?.toLowerCase() !== user.email.toLowerCase())
            return false;
          if (b.data.payment_method !== "membership_free") return false;
          if (b.data.record_status === "cancelled") return false;
          const d = new Date(b.data.session_date + "T12:00:00");
          return d >= start && d < end;
        }).length;
        const ok = freeUsed < SUBSCRIPTION_PLAN.freeSessionsPerWeek;
        setFreeAvailable(ok);
        return ok;
      } catch {
        setFreeAvailable(false);
        return false;
      } finally {
        setCheckingFree(false);
      }
    },
    [user]
  );

  useEffect(() => {
    listRecords<CmsContentData>("cms_content", 200)
      .then((rows) => {
        const keys = new Set<string>();
        for (const r of rows) {
          if (r.data.content_type !== "session_cancel") continue;
          if (r.data.record_status === "archived") continue;
          try {
            const body = JSON.parse(r.data.body_json) as {
              sessionKey?: string;
              date?: string;
              classId?: string;
              time?: string;
            };
            if (body.sessionKey) keys.add(body.sessionKey);
            if (body.date && body.classId && body.time) {
              keys.add(`${body.date}|${body.classId}|${body.time}`);
            }
          } catch {
            /* ignore */
          }
        }
        setCancelledKeys(keys);

        if (hqLocationId) {
          const loc = rows.find(
            (r) => r.id === hqLocationId && r.data.content_type === "hq_location"
          );
          if (loc) {
            const body = parseJsonSafe<HqLocationBody>(loc.data.body_json, { schedule: [] });
            setRemoteSlots(body.schedule || []);
            setLocationLabel(
              `${loc.data.title}${body.region ? `, ${body.region}` : ""} (HQ)`
            );
          } else {
            setRemoteSlots([]);
          }
        }
      })
      .catch(() => undefined);

    if (franchiseeId) {
      listRecords<FranchiseeData>("franchisees", 100)
        .then((rows) => {
          const f = rows.find((r) => r.id === franchiseeId);
          if (f) {
            setRemoteSlots(
              parseJsonSafe<FranchiseClassSlot[]>(f.data.schedule_json || "[]", [])
            );
            setLocationLabel(
              `${f.data.town_city}${f.data.region ? `, ${f.data.region}` : ""} — ${f.data.full_name}`
            );
          } else {
            setRemoteSlots([]);
          }
        })
        .catch(() => setRemoteSlots([]));
    }
  }, [hqLocationId, franchiseeId]);

  useEffect(() => {
    if (selected && isMember) {
      checkFreeForSession(selected.date);
    } else {
      setFreeAvailable(false);
    }
  }, [selected, isMember, checkFreeForSession]);

  async function assertCanBook(selectedSession: NonNullable<typeof selected>) {
    if (!user) throw new Error("Not signed in");
    const bookings = await listRecords<BookingData>("bookings", 200);
    const email = user.email.toLowerCase();
    const mine = bookings.filter(
      (b) =>
        b.data.member_id === user.id || (b.data.member_email || "").toLowerCase() === email
    );

    const dup = mine.find(
      (b) =>
        b.data.record_status !== "cancelled" &&
        b.data.class_id === selectedSession.classId &&
        b.data.session_date === selectedSession.date &&
        b.data.session_time === selectedSession.time
    );
    if (dup) {
      throw new Error(
        "You already have a booking for this class on this date. Cancel it first if you need to change."
      );
    }

    const unpaidPayAtClass = mine.filter(
      (b) =>
        b.data.record_status !== "cancelled" &&
        (b.data.payment_method === "pay_at_class" || b.data.payment_status === "pay_at_class") &&
        b.data.payment_status !== "paid"
    );
    if (unpaidPayAtClass.length >= 3) {
      throw new Error(
        "You already have 3 unpaid “pay at class” bookings. Please attend or cancel one before booking more."
      );
    }
  }

  async function createBooking(opts: {
    amount: number;
    method: string;
    payStatus: string;
    extraNote?: string;
  }) {
    if (!user || !selected) throw new Error("Missing user or session");
    await assertCanBook(selected);
    const rec = await createRecord<BookingData>("bookings", {
      member_id: user.id,
      member_email: user.email,
      member_name: user.name,
      class_id: selected.classId,
      class_title: selected.title,
      session_date: selected.date,
      session_time: selected.time,
      amount_gbp: opts.amount,
      payment_status: opts.payStatus,
      payment_method: opts.method,
      record_status: "confirmed",
      notes: [notes.trim(), opts.extraNote].filter(Boolean).join(" · "),
      // HQ satellite towns use location= id; franchisees use franchisee=
      franchisee_id: franchiseeId || (hqLocationId ? `hq:${hqLocationId}` : ""),
      franchisee_town: franchiseeTown || "",
      venue_name: venueOverride || selected.venueName,
    });
    setDoneAmount(opts.amount);
    setDone(rec.id);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError("Please log in or create an account before booking.");
      return;
    }
    if (!selected) {
      setError("Choose a class session.");
      return;
    }
    if (!siteDataReady) {
      setError(siteDataError || "Booking system is not available yet.");
      return;
    }
    setBusy(true);
    try {
      if (isMember) {
        const canFree = await checkFreeForSession(selected.date);
        if (canFree) {
          await createBooking({
            amount: 0,
            method: "membership_free",
            payStatus: "complimentary",
            extraNote: "Member free weekly class",
          });
          return;
        }
      }

      if (!paymentMethod) {
        setError("Please choose a payment option in step 3.");
        return;
      }
      if (paymentMethod === "paypal") {
        setError("Use the PayPal buttons below to pay by card, or choose pay at class.");
        return;
      }

      await createBooking({
        amount: selected.price,
        method: "pay_at_class",
        payStatus: "pay_at_class",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  const onPaypalPaid = useCallback(
    async (details: { orderId: string; payerEmail?: string }) => {
      if (!user || !selected) return;
      setBusy(true);
      setError(null);
      try {
        if (isMember) {
          const canFree = await checkFreeForSession(selected.date);
          if (canFree) {
            await createBooking({
              amount: 0,
              method: "membership_free",
              payStatus: "complimentary",
            });
            return;
          }
        }
        await createBooking({
          amount: selected.price,
          method: "paypal",
          payStatus: "paid",
          extraNote: `PayPal ${details.orderId}${details.payerEmail ? ` · ${details.payerEmail}` : ""}`,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Booking after payment failed");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, selected, isMember]
  );

  if (done) {
    return (
      <div className="card-surface mx-auto max-w-xl p-8 text-center">
        <CheckCircle2 className="mx-auto text-accent" size={48} />
        <h2 className="mt-4 font-display text-3xl tracking-wide">You&apos;re booked!</h2>
        <p className="mt-3 text-muted">
          {selected?.title} on {selected?.label}. Reference:{" "}
          <span className="font-mono text-cream">{done.slice(0, 8)}</span>
        </p>
        <p className="mt-2 text-sm text-muted">
          Amount:{" "}
          {doneAmount === 0
            ? "£0.00 — membership free class this week"
            : `£${doneAmount.toFixed(2)}`}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/account/" className="btn-primary">
            Dancer studio
          </Link>
          <Link href="/book/" className="btn-secondary" onClick={() => setDone(null)}>
            Book another
          </Link>
        </div>
      </div>
    );
  }

  const needsPaymentChoice = !(isMember && freeAvailable);

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {isMember && (
          <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm text-cream">
            <strong>Membership benefits active</strong>
            {user?.subscription_status === "cancelling" && user.period_end
              ? ` until ${formatDateUK(user.period_end)} (end of paid month).`
              : "."}{" "}
            1 free class per week.
            {selected && (
              <span className="mt-1 block text-muted">
                {checkingFree
                  ? "Checking free entitlement…"
                  : freeAvailable
                    ? "This booking will use your free class for that week."
                    : "Free class already used that week — payment required."}
              </span>
            )}
          </div>
        )}

        <div className="card-surface p-6">
          <h2 className="font-display text-2xl tracking-wide">1. Choose level</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setClassFilter("");
                setSessionKey("");
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                !classFilter ? "bg-accent text-bg" : "border border-line bg-white/5"
              }`}
            >
              All classes
            </button>
            {classFilters.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setClassFilter(c.id);
                  setSessionKey("");
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  classFilter === c.id ? "bg-accent text-bg" : "border border-line bg-white/5"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {locationLabel && (
            <p className="mt-3 text-sm text-accent">
              Booking for <strong>{locationLabel}</strong>
              {franchiseeTown ? ` · ${franchiseeTown}` : ""}
            </p>
          )}
        </div>

        <div className="card-surface p-6">
          <h2 className="font-display text-2xl tracking-wide">2. Pick a session</h2>
          <p className="mt-1 text-sm text-muted">One booking per class date — no duplicates.</p>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted">
                {isRemoteLocation && remoteSlots === null
                  ? "Loading sessions for this location…"
                  : isRemoteLocation
                    ? "No upcoming sessions published for this town yet."
                    : "No sessions available."}
              </p>
            )}
            {filtered.map((s) => (
              <label
                key={s.key}
                className={`flex cursor-pointer items-start gap-4 rounded-xl border p-3 transition ${
                  sessionKey === s.key
                    ? "border-accent bg-accent/10"
                    : "border-line bg-bg/40 hover:border-white/20"
                }`}
              >
                <input
                  type="radio"
                  name="session"
                  className="mt-4 accent-[var(--color-accent)]"
                  checked={sessionKey === s.key}
                  onChange={() => {
                    setSessionKey(s.key);
                    setPaymentMethod("");
                  }}
                />
                <div className="relative mt-1 h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                  <Image src={s.image} alt="" fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-cream">{s.title}</div>
                  <div className="text-sm text-muted">{s.label}</div>
                  <div className="mt-1 flex items-start gap-1 text-xs text-muted">
                    <MapPin size={12} className="mt-0.5 shrink-0 text-accent" />
                    {s.venueAddress}
                  </div>
                </div>
                <div className="font-bold text-accent">£{s.price}</div>
              </label>
            ))}
          </div>
        </div>

        {needsPaymentChoice && (
          <div className="card-surface border-accent/30 p-6 ring-1 ring-accent/20">
            <h2 className="font-display text-2xl tracking-wide">3. Payment option (required)</h2>
            <p className="mt-1 text-sm text-muted">
              You must select how you will pay before confirming. Nothing is pre-selected.
            </p>
            <div className="mt-4 space-y-3">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                  paymentMethod === "pay_at_class" ? "border-accent bg-accent/10" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="pay"
                  checked={paymentMethod === "pay_at_class"}
                  onChange={() => setPaymentMethod("pay_at_class")}
                  className="mt-1 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="font-semibold">Pay at class</span>
                  <span className="mt-1 block text-sm text-muted">
                    Secure your spot, pay £{SITE.classPrice} cash or card at the venue.
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                  paymentMethod === "paypal" ? "border-accent bg-accent/10" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="pay"
                  checked={paymentMethod === "paypal"}
                  onChange={() => setPaymentMethod("paypal")}
                  className="mt-1 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="font-semibold">Pay online (card via PayPal)</span>
                  <span className="mt-1 block text-sm text-muted">
                    Debit or credit card through PayPal.
                  </span>
                </span>
              </label>
              {paymentMethod === "paypal" && selected && (
                <PayPalCheckout
                  amountGbp={selected.price}
                  description={`${selected.title} · ${formatDateUK(selected.date)} ${selected.time}`}
                  onPaid={onPaypalPaid}
                  disabled={!user || busy}
                />
              )}
            </div>
          </div>
        )}

        <div className="card-surface p-6">
          <label className="block text-sm font-semibold">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none ring-accent/40 focus:ring-2"
            />
          </label>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <div className="card-surface p-6">
          <h3 className="font-display text-2xl tracking-wide">Summary</h3>
          {selected ? (
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li className="font-semibold text-cream">{selected.title}</li>
              <li>{selected.label}</li>
              <li className="text-lg font-bold text-accent">
                {isMember && freeAvailable
                  ? "£0.00 (membership free)"
                  : `£${selected.price.toFixed(2)}`}
              </li>
              {needsPaymentChoice && (
                <li>
                  Payment:{" "}
                  <strong className="text-cream">
                    {paymentMethod === "pay_at_class"
                      ? "Pay at class"
                      : paymentMethod === "paypal"
                        ? "PayPal / card"
                        : "Not selected yet"}
                  </strong>
                </li>
              )}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">Select a session to continue.</p>
          )}

          {!user && (
            <Link href="/account/login/?next=/book/" className="btn-primary mt-4 w-full !py-2 text-sm">
              Log in / Register
            </Link>
          )}

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={
              busy ||
              !selected ||
              !user ||
              (needsPaymentChoice && !paymentMethod) ||
              (paymentMethod === "paypal" && needsPaymentChoice)
            }
            className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Booking…
              </>
            ) : isMember && freeAvailable ? (
              "Confirm free member booking"
            ) : paymentMethod === "paypal" ? (
              "Use PayPal buttons above"
            ) : !paymentMethod && needsPaymentChoice ? (
              "Select payment in step 3"
            ) : (
              "Confirm booking"
            )}
          </button>
        </div>
      </aside>
    </form>
  );
}

export default function BookPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line pt-28 pb-12 md:pt-36">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,rgba(232,160,23,0.14),transparent_55%)]" />
        <div className="container-page">
          <p className="section-label">Book online</p>
          <h1 className="mt-3 font-display text-4xl tracking-wide md:text-6xl">
            Book a class — £{SITE.classPrice}
          </h1>
          <p className="mt-4 max-w-2xl text-muted">
            One booking per session. Choose payment explicitly when chargeable. Members: 1 free
            class per week.
          </p>
          <p className="mt-3 max-w-2xl text-xs text-muted">{BLACKOUT_NOTE}</p>
        </div>
      </section>
      <section className="py-12">
        <div className="container-page">
          <Suspense fallback={<p className="text-muted">Loading calendar…</p>}>
            <BookForm />
          </Suspense>
        </div>
      </section>
    </>
  );
}
