import { listRecords, createRecord, updateRecord, type CmsContentData } from "./sitedata";
import { parseJsonSafe } from "./cms-types";

export type PaymentSettings = {
  paypalClientId: string;
  paypalMode: "sandbox" | "live";
  /** PayPal Billing Plan ID for £40/month membership (P-…) */
  paypalSubscriptionPlanId: string;
  currency: string;
  enabled: boolean;
  notes: string;
  /** Resend.com API key for session cancellation emails */
  resendApiKey: string;
  resendFromEmail: string;
  resendEnabled: boolean;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  paypalClientId: "",
  paypalMode: "sandbox",
  paypalSubscriptionPlanId: "",
  currency: "GBP",
  enabled: false,
  notes: "",
  resendApiKey: "",
  resendFromEmail: "Boots N Boogie <onboarding@resend.dev>",
  resendEnabled: false,
};

const SETTINGS_SLUG = "payment_settings";

export async function loadPaymentSettings(): Promise<PaymentSettings> {
  try {
    const rows = await listRecords<CmsContentData>("cms_content", 100);
    const row = rows.find(
      (r) => r.data.content_type === "settings" && r.data.slug === SETTINGS_SLUG
    );
    if (!row) return { ...DEFAULT_PAYMENT_SETTINGS };
    return {
      ...DEFAULT_PAYMENT_SETTINGS,
      ...parseJsonSafe<Partial<PaymentSettings>>(row.data.body_json, {}),
    };
  } catch {
    return { ...DEFAULT_PAYMENT_SETTINGS };
  }
}

export async function savePaymentSettings(settings: PaymentSettings): Promise<void> {
  const rows = await listRecords<CmsContentData>("cms_content", 100);
  const existing = rows.find(
    (r) => r.data.content_type === "settings" && r.data.slug === SETTINGS_SLUG
  );
  const data = {
    content_type: "settings" as const,
    slug: SETTINGS_SLUG,
    title: "Payment & email settings",
    summary: "PayPal, subscriptions, Resend",
    body_json: JSON.stringify(settings),
    image_url: "",
    published: true,
    sort_order: 0,
    record_status: "active",
  };
  if (existing) {
    await updateRecord("cms_content", existing.id, data as unknown as CmsContentData);
  } else {
    await createRecord("cms_content", data as unknown as CmsContentData);
  }
}

export type EmailAttachment = {
  filename: string;
  /** Base64 content (no data: prefix) */
  content: string;
  contentType?: string;
};

export async function sendResendEmail(opts: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  /** Optional plain-text fallback */
  text?: string;
  attachments?: EmailAttachment[];
  /**
   * When true (default for multi-recipient), send one message per address
   * so recipients never see each other.
   */
  individual?: boolean;
}): Promise<{ ok: boolean; error?: string; sent?: number }> {
  if (!opts.to.length) return { ok: false, error: "No recipients" };
  try {
    const unique = Array.from(
      new Set(opts.to.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))
    );
    if (!unique.length) return { ok: false, error: "No valid recipient emails" };

    const individual = opts.individual !== false && unique.length > 1;
    const groups: string[][] = individual
      ? unique.map((e) => [e])
      : (() => {
          const batches: string[][] = [];
          for (let i = 0; i < unique.length; i += 40) batches.push(unique.slice(i, i + 40));
          return batches;
        })();

    let sent = 0;
    for (const batch of groups) {
      const payload: Record<string, unknown> = {
        from: opts.from,
        to: batch,
        subject: opts.subject,
        html: opts.html,
      };
      if (opts.text) payload.text = opts.text;
      if (opts.attachments?.length) {
        payload.attachments = opts.attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          ...(a.contentType ? { content_type: a.contentType } : {}),
        }));
      }

      // Prefer same-origin proxy (here.now variables → no browser CORS issues)
      let res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);

      // Fall back to direct Resend with key from admin settings
      if (!res || res.status === 404 || res.status === 405) {
        if (!opts.apiKey) {
          return {
            ok: false,
            error:
              "Email not configured. Set Resend in Admin → Payments, or add RESEND_API_KEY as a here.now variable with /api/email proxy.",
          };
        }
        res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${opts.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const t = await res.text();
        return {
          ok: false,
          error: t || `Email send failed (${res.status}) after ${sent} sent`,
          sent,
        };
      }
      sent += batch.length;
    }
    return { ok: true, sent };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email failed" };
  }
}
