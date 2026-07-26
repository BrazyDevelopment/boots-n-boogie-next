"use client";

import { useEffect, useRef, useState } from "react";
import { loadPaymentSettings, type PaymentSettings } from "@/lib/payments";

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void> };
    };
  }
}

type OneTimeProps = {
  mode?: "capture";
  amountGbp: number;
  description: string;
  onPaid: (details: { orderId: string; payerEmail?: string }) => void | Promise<void>;
  disabled?: boolean;
};

type SubProps = {
  mode: "subscription";
  onSubscribed: (details: { subscriptionId: string }) => void | Promise<void>;
  disabled?: boolean;
};

type Props = OneTimeProps | SubProps;

function loadSdk(clientId: string, currency: string, intent: "capture" | "subscription") {
  const scriptId =
    intent === "subscription" ? "paypal-sdk-bnb-sub" : "paypal-sdk-bnb-cap";
  return new Promise<void>((resolve, reject) => {
    if (window.paypal && document.getElementById(scriptId)) {
      resolve();
      return;
    }
    // If wrong intent script loaded, remove and reload
    const wrong = document.getElementById(
      intent === "subscription" ? "paypal-sdk-bnb-cap" : "paypal-sdk-bnb-sub"
    );
    if (wrong) {
      wrong.remove();
      delete (window as { paypal?: unknown }).paypal;
    }
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      if (window.paypal) resolve();
      return;
    }
    const s = document.createElement("script");
    s.id = scriptId;
    const q =
      intent === "subscription"
        ? `client-id=${encodeURIComponent(clientId)}&currency=${currency}&vault=true&intent=subscription`
        : `client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture`;
    s.src = `https://www.paypal.com/sdk/js?${q}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load PayPal SDK"));
    document.body.appendChild(s);
  });
}

export function PayPalCheckout(props: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const isSub = props.mode === "subscription";

  useEffect(() => {
    loadPaymentSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  useEffect(() => {
    if (!settings?.enabled || !settings.paypalClientId || !ref.current || props.disabled) {
      return;
    }
    if (!isSub && "amountGbp" in props && props.amountGbp <= 0) return;
    if (isSub && !settings.paypalSubscriptionPlanId) {
      setError("PayPal subscription plan ID not configured in Admin → Payments.");
      return;
    }

    let cancelled = false;
    const clientId = settings.paypalClientId.trim();
    const currency = settings.currency || "GBP";

    async function mount() {
      try {
        await loadSdk(clientId, currency, isSub ? "subscription" : "capture");
        if (cancelled || !ref.current || !window.paypal) return;
        ref.current.innerHTML = "";

        if (props.mode === "subscription") {
          const planId = settings!.paypalSubscriptionPlanId.trim();
          const onSubscribed = props.onSubscribed;
          await window.paypal
            .Buttons({
              style: { layout: "vertical", color: "gold", shape: "rect", label: "subscribe" },
              createSubscription: (
                _d: unknown,
                actions: { subscription: { create: (o: { plan_id: string }) => Promise<string> } }
              ) => actions.subscription.create({ plan_id: planId }),
              onApprove: async (data: { subscriptionID?: string }) => {
                if (data.subscriptionID) {
                  await onSubscribed({ subscriptionId: data.subscriptionID });
                }
              },
              onError: (err: unknown) => {
                setError(err instanceof Error ? err.message : "PayPal subscription error");
              },
            })
            .render(ref.current);
        } else {
          const amountGbp = props.amountGbp;
          const description = props.description;
          const onPaid = props.onPaid;
          await window.paypal
            .Buttons({
              style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
              createOrder: (
                _data: unknown,
                actions: { order: { create: (o: unknown) => Promise<string> } }
              ) =>
                actions.order.create({
                  purchase_units: [
                    {
                      description: description.slice(0, 120),
                      amount: {
                        currency_code: currency,
                        value: amountGbp.toFixed(2),
                      },
                    },
                  ],
                }),
              onApprove: async (
                data: { orderID: string },
                actions: {
                  order: {
                    capture: () => Promise<{ payer?: { email_address?: string } }>;
                  };
                }
              ) => {
                const details = await actions.order.capture();
                await onPaid({
                  orderId: data.orderID,
                  payerEmail: details?.payer?.email_address,
                });
              },
              onError: (err: unknown) => {
                setError(err instanceof Error ? err.message : "PayPal error");
              },
            })
            .render(ref.current);
        }
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "PayPal unavailable");
      }
    }

    mount();
    return () => {
      cancelled = true;
    };
  }, [settings, props, isSub]);

  if (!settings) {
    return <p className="text-xs text-muted">Loading card payment options…</p>;
  }

  if (!settings.enabled || !settings.paypalClientId) {
    return (
      <p className="rounded-xl border border-line bg-white/5 p-3 text-xs text-muted">
        Online card payments are not configured yet. Admin → Payments can add the PayPal Client ID
        {isSub ? " and Subscription Plan ID" : ""}.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
        {isSub ? "Subscribe monthly with PayPal" : "Pay by debit/credit card (PayPal)"}
        {settings.paypalMode === "sandbox" ? " · Sandbox" : ""}
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div ref={ref} className={props.disabled ? "pointer-events-none opacity-50" : ""} />
      {!ready && !error && <p className="text-xs text-muted">Loading PayPal…</p>}
    </div>
  );
}
