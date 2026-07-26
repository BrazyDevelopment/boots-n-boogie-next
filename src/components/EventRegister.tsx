"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { PayPalCheckout } from "@/components/PayPalButtons";
import { useAuth } from "@/context/AuthContext";
import type { BnBEvent } from "@/lib/events";
import {
  assertFirstTimerPlusOne,
  assertPlusOneAvailable,
  findMemberEventReg,
} from "@/lib/events";
import { EVENT_SUBSCRIBER_DISCOUNT, hasMembershipBenefits } from "@/lib/membership";
import { loadPaymentSettings, sendResendEmail } from "@/lib/payments";
import { SITE } from "@/lib/data";
import {
  createRecord,
  listRecords,
  updateRecord,
  type SocialRegData,
  type SiteRecord,
} from "@/lib/sitedata";

type PayChoice = "" | "pay_at_door" | "paypal";

export function EventRegister({ event }: { event: BnBEvent }) {
  const { user, siteDataReady, siteDataError } = useAuth();
  const [ticketId, setTicketId] = useState(event.tickets[0]?.id || "");
  const [plusOne, setPlusOne] = useState(false);
  const [plusName, setPlusName] = useState("");
  const [plusEmail, setPlusEmail] = useState("");
  const [plusFirst, setPlusFirst] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PayChoice>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [existing, setExisting] = useState<SiteRecord<SocialRegData> | null>(null);
  const [loadingReg, setLoadingReg] = useState(true);
  const [inviteNote, setInviteNote] = useState<string | null>(null);

  const ticket = event.tickets.find((t) => t.id === ticketId) || event.tickets[0];
  const isSubscriber = hasMembershipBenefits(user?.subscription_status, user?.period_end);

  const pricing = useMemo(() => {
    const base = ticket?.price || 0;

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

  const needsPayment = pricing.amount > 0;
  const isAddPlusOnly =
    !!existing && event.isSocial && isSubscriber && !existing.data.plus_one_name;

  const refreshExisting = useCallback(async () => {
    if (!user) {
      setExisting(null);
      setLoadingReg(false);
      return;
    }
    setLoadingReg(true);
    try {
      const allRegs = await listRecords<SocialRegData>("social_regs", 400);
      const reg = findMemberEventReg(allRegs, {
        eventId: event.id,
        memberId: user.id,
        memberEmail: user.email,
      });
      setExisting(reg || null);
      if (reg?.data.plus_one_name) {
        setPlusOne(true);
        setPlusName(reg.data.plus_one_name);
        setPlusEmail(reg.data.plus_one_email || "");
        setPlusFirst(!!reg.data.plus_one_first_timer);
      }
    } catch {
      setExisting(null);
    } finally {
      setLoadingReg(false);
    }
  }, [user, event.id]);

  useEffect(() => {
    refreshExisting().catch(() => undefined);
  }, [refreshExisting]);

  async function maybeSendPlusOneInvite(opts: {
    hostName: string;
    plusName: string;
    plusEmail: string;
    free: boolean;
  }) {
    try {
      const settings = await loadPaymentSettings();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const result = await sendResendEmail({
        apiKey: settings.resendApiKey,
        from: settings.resendFromEmail || `Boots N Boogie <${SITE.email}>`,
        to: [opts.plusEmail],
        subject: `${opts.hostName} invited you to ${event.title} · ${SITE.name}`,
        html: `
          <p>Hi${opts.plusName ? ` ${opts.plusName}` : ""},</p>
          <p><strong>${opts.hostName}</strong> has added you as their guest (+1) for:</p>
          <p style="font-size:16px;margin:16px 0"><strong>${event.title}</strong><br/>
          ${event.dateLabel || event.dateISO} · ${event.time}<br/>
          ${event.venue}</p>
          <p>${
            opts.free
              ? "Your guest place is complimentary as a first-timer +1 (membership perk)."
              : "Your host has registered a guest ticket for you."
          }</p>
          <p>You do <strong>not</strong> need an account to attend as a +1 — just arrive with your host. If you’d like your own dancer account for classes later, you can create one anytime:</p>
          <p style="margin:20px 0">
            <a href="${origin}/account/login/" style="background:#e8a017;color:#1a1208;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">
              Create a free account
            </a>
          </p>
          <p style="color:#666;font-size:13px">Questions? ${SITE.email}</p>
          <p>— ${SITE.name}</p>
        `,
      });
      if (result.ok) {
        setInviteNote(`Invite email sent to ${opts.plusEmail}.`);
      } else {
        setInviteNote(
          `Registration saved. Could not email the +1 (${result.error || "email not configured"}) — tell them in person.`
        );
      }
    } catch {
      setInviteNote("Registration saved. Invite email could not be sent — tell your guest in person.");
    }
  }

  async function saveRegistration(opts: {
    amount: number;
    method: string;
    payStatus: string;
    paymentRef?: string;
    plus?: { name: string; email: string; first: boolean };
  }) {
    if (!user) throw new Error("Not signed in");

    const allRegs = await listRecords<SocialRegData>("social_regs", 400);
    const mine = findMemberEventReg(allRegs, {
      eventId: event.id,
      memberId: user.id,
      memberEmail: user.email,
    });

    const wantPlus = !!(opts.plus?.name.trim());
    if (wantPlus && opts.plus) {
      const email = opts.plus.email.trim().toLowerCase();
      if (opts.plus.first) {
        const check = assertFirstTimerPlusOne(allRegs, email, { allowRegId: mine?.id });
        if (!check.ok) throw new Error(check.reason);
      } else {
        const check = assertPlusOneAvailable(allRegs, email, { allowRegId: mine?.id });
        if (!check.ok) throw new Error(check.reason);
      }
    }

    const payload: Partial<SocialRegData> = {
      member_id: user.id,
      member_email: user.email,
      member_name: user.name,
      event_id: event.id,
      event_title: event.title,
      ticket_type: pricing.type,
      plus_one_name: wantPlus && opts.plus ? opts.plus.name.trim() : "",
      plus_one_email: wantPlus && opts.plus ? opts.plus.email.trim().toLowerCase() : "",
      plus_one_first_timer: wantPlus && opts.plus ? opts.plus.first : false,
      amount_gbp: opts.amount,
      payment_status: opts.payStatus,
      payment_method: opts.method,
      payment_ref: opts.paymentRef || "",
      record_status: "confirmed",
      checked_in: mine?.data.checked_in || false,
    };

    let regId = mine?.id;
    if (mine) {
      // Adding/updating +1 on existing booking, or re-confirming
      await updateRecord<SocialRegData>("social_regs", mine.id, payload);
    } else {
      const rec = await createRecord<SocialRegData>("social_regs", {
        ...payload,
        member_id: user.id,
        member_email: user.email,
        member_name: user.name,
        event_id: event.id,
        event_title: event.title,
        ticket_type: pricing.type,
        amount_gbp: opts.amount,
        payment_status: opts.payStatus,
        record_status: "confirmed",
        checked_in: false,
      } as SocialRegData);
      regId = rec.id;
    }

    if (wantPlus && opts.plus?.email) {
      await maybeSendPlusOneInvite({
        hostName: user.name,
        plusName: opts.plus.name,
        plusEmail: opts.plus.email.trim().toLowerCase(),
        free: !!opts.plus.first && pricing.type === "subscriber_plus_one_free",
      });
    }

    setDone(regId || "ok");
    await refreshExisting();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteNote(null);
    if (!user) {
      setError("Log in to register.");
      return;
    }
    if (event.status !== "open") {
      setError("Registration is closed for this event.");
      return;
    }
    if (!siteDataReady) {
      setError(siteDataError || "Registration system unavailable.");
      return;
    }

    // Already fully registered with +1 (or non-social paid ticket) — don't duplicate
    if (existing && !isAddPlusOnly) {
      if (event.isSocial && isSubscriber && existing.data.plus_one_name) {
        setError("You’re already registered for this event (with a +1). Manage details in your studio.");
        return;
      }
      if (!event.isSocial || !isSubscriber) {
        setError("You’re already registered for this event.");
        return;
      }
    }

    if (plusOne && !plusName.trim()) {
      setError("Enter your +1’s full name.");
      return;
    }
    if (plusOne && !plusEmail.trim()) {
      setError("Enter your +1’s email so we can reserve their unique guest place.");
      return;
    }

    if (needsPayment && !isAddPlusOnly) {
      if (!paymentMethod) {
        setError("Please choose a payment option.");
        return;
      }
      if (paymentMethod === "paypal") {
        setError("Use the PayPal buttons below to pay by card, or choose pay at the door.");
        return;
      }
    }

    // Adding +1 only to existing free member reg — may need payment if paid guest
    if (isAddPlusOnly) {
      if (!plusOne) {
        setError("Tick “Bring a +1” and fill in their details.");
        return;
      }
      if (needsPayment) {
        if (!paymentMethod) {
          setError("Please choose how to pay for your guest ticket.");
          return;
        }
        if (paymentMethod === "paypal") {
          setError("Use the PayPal buttons below to pay for your guest, or choose pay at the door.");
          return;
        }
      }
    }

    setBusy(true);
    try {
      const amount = isAddPlusOnly
        ? pricing.amount
        : pricing.amount;
      const method =
        amount <= 0
          ? isSubscriber
            ? "membership"
            : "complimentary"
          : paymentMethod === "pay_at_door"
            ? "pay_at_door"
            : "pay_at_door";
      const payStatus = amount <= 0 ? "complimentary" : "pay_at_door";

      await saveRegistration({
        amount,
        method,
        payStatus,
        plus: plusOne
          ? { name: plusName, email: plusEmail, first: plusFirst }
          : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  const onPaypalPaid = useCallback(
    async (details: { orderId: string; payerEmail?: string }) => {
      if (!user) return;
      setBusy(true);
      setError(null);
      setInviteNote(null);
      try {
        if (plusOne && !plusName.trim()) throw new Error("Enter your +1’s full name.");
        if (plusOne && !plusEmail.trim()) throw new Error("Enter your +1’s email.");

        await saveRegistration({
          amount: pricing.amount,
          method: "paypal",
          payStatus: "paid",
          paymentRef: details.orderId,
          plus: plusOne
            ? { name: plusName, email: plusEmail, first: plusFirst }
            : undefined,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Registration after payment failed");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, plusOne, plusName, plusEmail, plusFirst, pricing.amount, event.id]
  );

  if (loadingReg) {
    return (
      <div className="card-surface flex items-center gap-2 p-7 text-sm text-muted">
        <Loader2 className="animate-spin" size={16} /> Checking your registration…
      </div>
    );
  }

  if (done) {
    return (
      <div className="card-surface p-7">
        <CheckCircle2 className="text-accent" size={40} />
        <h2 className="mt-3 font-display text-3xl tracking-wide text-accent">
          {isAddPlusOnly || existing ? "You’re all set" : "You’re registered"}
        </h2>
        <p className="mt-3 text-sm text-muted">
          {event.title} — {pricing.label}. Amount: £{pricing.amount.toFixed(2)}.
        </p>
        {inviteNote && <p className="mt-2 text-sm text-cream">{inviteNote}</p>}
        <Link href="/account/" className="btn-primary mt-6">
          View in my account
        </Link>
      </div>
    );
  }

  // Already registered with no ability to add more (has +1, or non-member ticket)
  if (existing && !isAddPlusOnly) {
    return (
      <div className="card-surface p-7">
        <h2 className="font-display text-3xl tracking-wide">You’re registered</h2>
        <p className="mt-3 text-sm text-muted">
          {event.title}
          {existing.data.plus_one_name
            ? ` · +1: ${existing.data.plus_one_name}`
            : ""}
          . Amount recorded: £{Number(existing.data.amount_gbp).toFixed(2)}.
        </p>
        <Link href="/account/?tab=guests" className="btn-primary mt-6">
          Open dancer studio
        </Link>
      </div>
    );
  }

  const showPlusUi = event.isSocial && isSubscriber;
  const formTitle = isAddPlusOnly ? "Add your +1" : "Register";

  return (
    <form onSubmit={onSubmit} className="card-surface h-fit p-7">
      <h2 className="font-display text-3xl tracking-wide">{formTitle}</h2>
      <p className="mt-2 text-sm text-muted">
        {event.status === "open"
          ? isAddPlusOnly
            ? "You’re already booked in — add a guest below."
            : "Tickets open"
          : "Registration closed — you can still view details."}
      </p>

      {(!event.isSocial || !isSubscriber) && !isAddPlusOnly && (
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

      {showPlusUi && (
        <div className="mt-5 space-y-3">
          {!isAddPlusOnly && (
            <p className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm text-cream">
              Active member — your entry is free.
            </p>
          )}
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
                  required
                  className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                +1 email
                <input
                  type="email"
                  value={plusEmail}
                  onChange={(e) => setPlusEmail(e.target.value)}
                  required
                  className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal"
                />
              </label>
              <p className="text-[11px] text-muted">
                We email them an invite (they don’t need an account). Each email can only be used as
                a +1 once — never shared between members or reused on other events.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={plusFirst}
                  onChange={(e) => setPlusFirst(e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                They have never been to a Boots N Boogie social before (free guest)
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

      {needsPayment && (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-cream">Payment option (required)</p>
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
              paymentMethod === "pay_at_door" ? "border-accent bg-accent/10" : "border-line"
            }`}
          >
            <input
              type="radio"
              name="event-pay"
              checked={paymentMethod === "pay_at_door"}
              onChange={() => setPaymentMethod("pay_at_door")}
              className="mt-1 accent-[var(--color-accent)]"
            />
            <span>
              <span className="font-semibold">Pay at the door</span>
              <span className="mt-1 block text-sm text-muted">
                Reserve your place, pay £{pricing.amount.toFixed(2)} cash or card at the venue.
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
              name="event-pay"
              checked={paymentMethod === "paypal"}
              onChange={() => setPaymentMethod("paypal")}
              className="mt-1 accent-[var(--color-accent)]"
            />
            <span>
              <span className="font-semibold">Pay online (card via PayPal)</span>
              <span className="mt-1 block text-sm text-muted">Debit or credit card through PayPal.</span>
            </span>
          </label>
          {paymentMethod === "paypal" && (
            <PayPalCheckout
              amountGbp={pricing.amount}
              description={`${event.title} · ${pricing.label}`}
              onPaid={onPaypalPaid}
              disabled={!user || busy || event.status !== "open"}
            />
          )}
        </div>
      )}

      {!user && (
        <Link
          href={`/account/login/?next=/events/${event.id}/`}
          className="btn-secondary mt-4 w-full"
        >
          Log in to register
        </Link>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={
          busy ||
          !user ||
          event.status !== "open" ||
          (needsPayment && !paymentMethod) ||
          (needsPayment && paymentMethod === "paypal")
        }
        className="btn-primary mt-4 w-full disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="animate-spin" size={18} /> Saving…
          </>
        ) : isAddPlusOnly ? (
          "Save +1"
        ) : needsPayment && paymentMethod === "paypal" ? (
          "Pay with PayPal above"
        ) : (
          "Confirm registration"
        )}
      </button>
    </form>
  );
}
