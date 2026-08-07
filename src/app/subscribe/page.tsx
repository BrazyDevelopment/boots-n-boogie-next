"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";
import { Check, Loader2, Shield, Banknote, CreditCard } from "lucide-react";
import { PayPalCheckout } from "@/components/PayPalButtons";
import { useAuth } from "@/context/AuthContext";
import { mandateRef } from "@/lib/auth-crypto";
import { SITE, SUBSCRIPTION_PLAN, VENUES } from "@/lib/data";
import {
  createRecord,
  updateRecord,
  type MemberData,
  type SubscriptionData,
} from "@/lib/sitedata";

type PayMode = "direct_debit" | "cash" | "paypal";

export default function SubscribePage() {
  const { user, siteDataReady, refreshUser } = useAuth();
  const [payMode, setPayMode] = useState<PayMode>("cash");
  const [accountName, setAccountName] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ ref: string; mode: PayMode } | null>(null);

  async function createMembership(opts: {
    planSuffix: string;
    account_name: string;
    account_number: string;
    sort_code: string;
    mandate_ref: string;
    record_status: "active" | "pending_cash";
    payment_method: string;
    /** Only true when payment is fully confirmed (DD set up, PayPal paid). Cash stays pending. */
    activateMember: boolean;
  }) {
    if (!user) throw new Error("Not signed in");
    const started = new Date().toISOString();
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    const digits = opts.account_number.replace(/\D/g, "");
    const sub = await createRecord<SubscriptionData>("subscriptions", {
      member_id: user.id,
      member_email: user.email,
      member_name: user.name,
      plan_id: `${SUBSCRIPTION_PLAN.id}_${opts.planSuffix}`,
      amount_gbp: SUBSCRIPTION_PLAN.amountGbp,
      record_status: opts.record_status,
      account_name: opts.account_name,
      account_number: opts.account_number,
      account_last4: digits.slice(-4) || "0000",
      sort_code: opts.sort_code,
      mandate_ref: opts.mandate_ref,
      payment_method: opts.payment_method,
      started_at: started,
      next_collection_at: next.toISOString().slice(0, 10),
    });
    await updateRecord<MemberData>("members", user.id, {
      subscription_status: opts.activateMember ? "active" : "pending_cash",
      subscription_id: sub.id,
    });
    await refreshUser();
    setSuccess({ ref: opts.mandate_ref, mode: payMode });
  }

  async function onSubmitDd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) {
      setError("Log in to set up membership.");
      return;
    }
    if (!siteDataReady) {
      setError("Membership system unavailable offline.");
      return;
    }
    const sc = sortCode.replace(/\D/g, "");
    const an = accountNumber.replace(/\D/g, "");
    if (sc.length !== 6) {
      setError("Sort code must be 6 digits.");
      return;
    }
    if (an.length < 6 || an.length > 10) {
      setError("Enter the full UK account number (usually 8 digits).");
      return;
    }
    setBusy(true);
    try {
      await createMembership({
        planSuffix: "dd",
        account_name: accountName.trim(),
        account_number: an,
        sort_code: `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4)}`,
        mandate_ref: mandateRef(),
        // Same as cash: studio activates before free classes apply
        record_status: "pending_cash",
        payment_method: "direct_debit",
        activateMember: false,
      });
      // pending_dd on member for clearer messaging (subscription row stays pending_cash for Activate button)
      if (user) {
        await updateRecord<MemberData>("members", user.id, {
          subscription_status: "pending_dd",
        });
        await refreshUser();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create mandate");
    } finally {
      setBusy(false);
    }
  }

  async function onCash() {
    setError(null);
    if (!user) {
      setError("Log in first.");
      return;
    }
    setBusy(true);
    try {
      await createMembership({
        planSuffix: "cash",
        account_name: "Cash at Arnold House",
        account_number: "CASH",
        sort_code: "CASH-00",
        mandate_ref: `BNB-CASH-${Date.now().toString(36).toUpperCase()}`,
        record_status: "pending_cash",
        payment_method: "cash",
        activateMember: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register cash membership");
    } finally {
      setBusy(false);
    }
  }

  const blocked =
    !user ||
    user.subscription_status === "active" ||
    user.subscription_status === "pending_cash" ||
    user.subscription_status === "pending_dd";

  return (
    <>
      <section className="relative overflow-hidden border-b border-line pt-28 pb-14 md:pt-36">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_80%_0%,rgba(196,92,38,0.18),transparent_55%)]" />
        <div className="container-page">
          <p className="section-label">Membership</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl tracking-wide md:text-6xl">
            Social membership · £{SUBSCRIPTION_PLAN.amountGbp}/month
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">{SUBSCRIPTION_PLAN.description}</p>
          <p className="mt-6 font-display text-5xl text-accent">
            £{SUBSCRIPTION_PLAN.amountGbp.toFixed(0)}
            <span className="text-2xl text-muted"> / month per person</span>
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container-page grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl tracking-wide">What you get</h2>
            <ul className="mt-6 space-y-4">
              {SUBSCRIPTION_PLAN.benefits.map((b) => (
                <li key={b} className="flex gap-3 text-muted">
                  <Check className="mt-0.5 shrink-0 text-accent" size={20} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="card-surface mt-8 space-y-3 p-6 text-sm text-muted">
              <p className="font-semibold text-cream">How to pay</p>
              <p>
                <strong className="text-cream">Cash</strong> — register online, pay £
                {SUBSCRIPTION_PLAN.amountGbp} at {VENUES.arnoldHouse.name}. Free classes unlock only
                after an admin activates your membership.
              </p>
              <p>
                <strong className="text-cream">Direct Debit</strong> — register with your bank
                details for the studio to set up the mandate. Free classes unlock only after an admin
                activates your membership.
              </p>
              <p>
                <strong className="text-cream">PayPal or card</strong> — open PayPal to pay with
                PayPal balance, bank, or enter debit/credit card details for a monthly subscription.
              </p>
            </div>
          </div>

          <div className="card-surface p-7 md:p-9">
            {success ? (
              <div>
                <h2 className="font-display text-3xl tracking-wide text-accent">
                  {success.mode === "cash" ? "Cash membership registered" : "You&apos;re a member"}
                </h2>
                <p className="mt-3 text-muted">
                  Reference <span className="font-mono text-cream">{success.ref}</span>.
                </p>
                            {success.mode === "cash" || success.mode === "direct_debit" ? (
                  <p className="mt-3 text-sm text-muted">
                    {success.mode === "cash"
                      ? `Pay £${SUBSCRIPTION_PLAN.amountGbp} cash at ${VENUES.arnoldHouse.name} (${VENUES.arnoldHouse.address}). `
                      : "We’ve saved your Direct Debit details for the studio to set up the mandate. "}
                    Free weekly classes and social benefits unlock after the studio activates your
                    membership in Admin.
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    You can book your free weekly class now from the dancer studio.
                  </p>
                )}
                <div className="mt-6 flex flex-wrap gap-3">
                  {success.mode === "paypal" && (
                    <Link href="/book/" className="btn-primary">
                      Book free class
                    </Link>
                  )}
                  <Link href="/account/" className="btn-secondary">
                    Dancer studio
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <h2 className="font-display text-3xl tracking-wide">Join membership</h2>
                {!user && (
                  <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm">
                    <Link
                      href="/account/login/?next=/subscribe/"
                      className="font-bold text-accent underline"
                    >
                      Log in or register first →
                    </Link>
                  </div>
                )}
                {user?.subscription_status === "active" && (
                  <p className="text-sm text-accent">You already have an active membership.</p>
                )}
                {(user?.subscription_status === "pending_cash" ||
                  user?.subscription_status === "pending_dd") && (
                  <p className="text-sm text-accent">
                    Membership pending — free classes unlock after admin activation.
                    {user.subscription_status === "pending_cash"
                      ? ` Pay £${SUBSCRIPTION_PLAN.amountGbp} cash at ${VENUES.arnoldHouse.name}.`
                      : " Direct Debit details received — the studio will set up the mandate."}
                  </p>
                )}

                <div className="space-y-2">
                  {(
                    [
                      ["cash", "Cash at The Arnold House", Banknote],
                      ["direct_debit", "Direct Debit", Shield],
                      ["paypal", "Subscribe via PayPal or Card", CreditCard],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <label
                      key={id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${
                        payMode === id ? "border-accent bg-accent/10" : "border-line"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payMode"
                        checked={payMode === id}
                        onChange={() => setPayMode(id)}
                        className="accent-[var(--color-accent)]"
                      />
                      <Icon size={18} className="text-accent" />
                      <span className="text-sm font-semibold">{label}</span>
                    </label>
                  ))}
                </div>

                {payMode === "cash" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted">
                      Register now, pay cash at the venue. Admin activates membership before free
                      classes apply.
                    </p>
                    <button
                      type="button"
                      disabled={busy || blocked}
                      onClick={onCash}
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Register — pay cash at Arnold House"}
                    </button>
                  </div>
                )}

                {payMode === "direct_debit" && (
                  <form onSubmit={onSubmitDd} className="space-y-4">
                    <p className="text-sm text-muted">
                      Register now with your bank details so the studio can set up Direct Debit.
                      Admin activates membership before free classes apply.
                    </p>
                    <label className="block text-sm font-semibold">
                      Account holder name
                      <input
                        required
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Sort code
                      <input
                        required
                        inputMode="numeric"
                        placeholder="12-34-56"
                        value={sortCode}
                        onChange={(e) => setSortCode(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </label>
                    <label className="block text-sm font-semibold">
                      Full account number
                      <input
                        required
                        inputMode="numeric"
                        placeholder="12345678"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </label>
                    <p className="text-xs text-muted">
                      Authorise £{SUBSCRIPTION_PLAN.amountGbp.toFixed(2)} monthly once the studio
                      activates your membership.
                    </p>
                    <button
                      type="submit"
                      disabled={busy || blocked}
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Register for Direct Debit"}
                    </button>
                  </form>
                )}

                {payMode === "paypal" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted">
                      Start a{" "}
                      <strong className="text-cream">
                        recurring £{SUBSCRIPTION_PLAN.amountGbp}/month
                      </strong>{" "}
                      subscription via PayPal. You can use PayPal balance, link a bank, or enter
                      debit/credit card details on the PayPal screen.
                    </p>
                    {user && !blocked ? (
                      <PayPalCheckout
                        mode="subscription"
                        onSubscribed={async ({ subscriptionId }) => {
                          setBusy(true);
                          setError(null);
                          try {
                            await createMembership({
                              planSuffix: "paypal_sub",
                              account_name: "PayPal subscription",
                              account_number: "PAYPAL-SUB",
                              sort_code: "PP-SUB",
                              mandate_ref: `BNB-PPSUB-${subscriptionId.slice(-12).toUpperCase()}`,
                              record_status: "active",
                              payment_method: "paypal_subscription",
                              activateMember: true,
                            });
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : "PayPal subscription failed"
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                        disabled={busy}
                      />
                    ) : (
                      <p className="text-sm text-muted">Log in to subscribe with PayPal.</p>
                    )}
                  </div>
                )}

                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
