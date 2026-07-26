"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { EVENTS } from "@/lib/data";
import { EVENT_SUBSCRIBER_DISCOUNT, hasMembershipBenefits } from "@/lib/membership";
import { createRecord, listRecords, type SocialRegData } from "@/lib/sitedata";

type EventItem = (typeof EVENTS)[number];

export function EventRegister({ event }: { event: EventItem }) {
  const { user, siteDataReady } = useAuth();
  const [ticketId, setTicketId] = useState(event.tickets[0]?.id || "");
  const [plusOne, setPlusOne] = useState(false);
  const [plusName, setPlusName] = useState("");
  const [plusEmail, setPlusEmail] = useState("");
  const [plusFirst, setPlusFirst] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ticket = event.tickets.find((t) => t.id === ticketId) || event.tickets[0];
  const isSubscriber = hasMembershipBenefits(user?.subscription_status, user?.period_end);

  const pricing = useMemo(() => {
    const base = ticket?.price || 0;

    // Quarterly socials: free entry for members (+ free first-timer +1)
    if (event.isSocial && isSubscriber) {
      const plusCost = plusOne && plusFirst ? 0 : plusOne ? base : 0;
      return {
        amount: plusCost,
        type: plusOne
          ? plusFirst
            ? "subscriber_plus_one_free"
            : "subscriber_plus_one_paid"
          : "subscriber_free",
        label: plusOne
          ? plusFirst
            ? "Subscriber + free first-timer guest"
            : "Subscriber + paid guest"
          : "Subscriber free entry",
        original: base,
        discounted: false,
      };
    }

    // Temporary events (workshops etc.): 20% off for subscribers
    if (!event.isSocial && isSubscriber && base > 0) {
      const amount = Math.round(base * (1 - EVENT_SUBSCRIBER_DISCOUNT) * 100) / 100;
      return {
        amount,
        type: "subscriber_event_discount",
        label: `${ticket?.name || "Ticket"} · 20% member discount`,
        original: base,
        discounted: true,
      };
    }

    return {
      amount: base,
      type: "paid",
      label: ticket?.name || "General admission",
      original: base,
      discounted: false,
    };
  }, [event.isSocial, isSubscriber, plusOne, plusFirst, ticket]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError("Log in to register.");
      return;
    }
    if (event.status !== "open") {
      setError("Registration is closed for this event.");
      return;
    }
    if (!siteDataReady) {
      setError("Registration system unavailable.");
      return;
    }
    if (plusOne && !plusName.trim()) {
      setError("Enter your +1’s name.");
      return;
    }
    setBusy(true);
    try {
      const allRegs = await listRecords<SocialRegData>("social_regs", 200);
      const already = allRegs.find(
        (r) =>
          r.data.record_status !== "cancelled" &&
          r.data.event_id === event.id &&
          (r.data.member_id === user.id ||
            r.data.member_email.toLowerCase() === user.email.toLowerCase())
      );
      if (already) {
        setError("You are already registered for this event.");
        setBusy(false);
        return;
      }

      if (plusOne && plusFirst) {
        const email = plusEmail.trim().toLowerCase();
        if (email) {
          const beenBefore = allRegs.some(
            (r) =>
              r.data.plus_one_email?.toLowerCase() === email ||
              r.data.member_email.toLowerCase() === email
          );
          if (beenBefore) {
            setError(
              "This guest appears to have been to a Boots N Boogie social before — free +1 only applies to first-timers."
            );
            setBusy(false);
            return;
          }
        }
      }
      await createRecord<SocialRegData>("social_regs", {
        member_id: user.id,
        member_email: user.email,
        member_name: user.name,
        event_id: event.id,
        event_title: event.title,
        ticket_type: pricing.type,
        plus_one_name: plusOne ? plusName.trim() : "",
        plus_one_email: plusOne ? plusEmail.trim() : "",
        plus_one_first_timer: plusOne ? plusFirst : false,
        amount_gbp: pricing.amount,
        payment_status: pricing.amount === 0 ? "complimentary" : "pay_at_door",
        record_status: "confirmed",
        checked_in: false,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card-surface p-7">
        <h2 className="font-display text-3xl tracking-wide text-accent">You&apos;re registered</h2>
        <p className="mt-3 text-sm text-muted">
          {event.title} — {pricing.label}. Amount due: £{pricing.amount.toFixed(2)}.
        </p>
        <Link href="/account/" className="btn-primary mt-6">
          View in my account
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-surface h-fit p-7">
      <h2 className="font-display text-3xl tracking-wide">Register</h2>
      <p className="mt-2 text-sm text-muted">
        {event.status === "open" ? "Tickets open" : "Registration closed — you can still view details."}
      </p>

      {(!event.isSocial || !isSubscriber) && (
        <label className="mt-5 block text-sm font-semibold">
          Ticket type
          <select
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal"
          >
            {event.tickets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — £{t.price.toFixed(2)}
                {isSubscriber && !event.isSocial
                  ? ` (you pay £${(t.price * (1 - EVENT_SUBSCRIBER_DISCOUNT)).toFixed(2)})`
                  : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {event.isSocial && isSubscriber && (
        <div className="mt-5 space-y-3">
          <p className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm text-cream">
            Active member — your entry is free.
          </p>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={plusOne}
              onChange={(e) => setPlusOne(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            Bring a +1
          </label>
          {plusOne && (
            <>
              <label className="block text-sm font-semibold">
                +1 full name
                <input
                  value={plusName}
                  onChange={(e) => setPlusName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                +1 email (for first-timer check)
                <input
                  type="email"
                  value={plusEmail}
                  onChange={(e) => setPlusEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={plusFirst}
                  onChange={(e) => setPlusFirst(e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                They have never been to a Boots N Boogie social before
              </label>
            </>
          )}
        </div>
      )}

      {!event.isSocial && isSubscriber && (
        <p className="mt-4 text-sm text-accent">
          Member discount: 20% off temporary events (was £{pricing.original.toFixed(2)}).
        </p>
      )}

      <div className="mt-6 border-t border-line pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted">{pricing.label}</span>
          <span className="font-bold text-accent">
            {pricing.discounted && (
              <span className="mr-2 text-muted line-through">£{pricing.original.toFixed(2)}</span>
            )}
            £{pricing.amount.toFixed(2)}
          </span>
        </div>
      </div>

      {!user && (
        <Link href={`/account/login/?next=/events/${event.id}/`} className="btn-secondary mt-4 w-full">
          Log in to register
        </Link>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || !user || event.status !== "open"}
        className="btn-primary mt-4 w-full disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Saving…
          </>
        ) : (
          "Confirm registration"
        )}
      </button>
    </form>
  );
}
