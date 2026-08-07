/** here.now Site Data client (browser-relative paths) */

export type SiteRecord<T extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  created_at?: string;
  updated_at?: string;
  /** here.now API camelCase */
  createdAt?: string;
  updatedAt?: string;
  data: T;
};

/** Root-absolute so nested routes (/book/, /admin/) hit Site Data correctly */
const BASE = "/.herenow/data";

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || `Request failed (${res.status})`);
  }
}

export async function listRecords<T extends Record<string, unknown>>(
  collection: string,
  limit = 200
): Promise<SiteRecord<T>[]> {
  const all: SiteRecord<T>[] = [];
  let cursor: string | null = null;
  do {
    const q = new URLSearchParams({ limit: String(Math.min(limit, 50)) });
    if (cursor) q.set("cursor", cursor);
    const res = await fetch(`${BASE}/${collection}?${q}`, { cache: "no-store" });
    if (!res.ok) {
      const err = (await parseJson(res).catch(() => ({}))) as {
        error?: string;
        message?: string;
        code?: string;
      };
      // Local dev / wrong host: empty list. Live "collection_disabled" must surface clearly.
      if (err.code === "collection_disabled" || /collection not found/i.test(err.error || "")) {
        throw new Error(
          "Account database is not active on this site yet (Site Data collections missing). Redeploy with .herenow/data.json included."
        );
      }
      if (res.status === 403 && /account_required/i.test(err.code || err.error || "")) {
        throw new Error("Site Data requires a claimed here.now site.");
      }
      if (res.status === 404 && !err.code) return all;
      throw new Error(err.error || err.message || `List failed (${res.status})`);
    }
    const body = await parseJson(res);
    const records = (body.records || []) as SiteRecord<T>[];
    all.push(...records);
    cursor = body.nextCursor || null;
  } while (cursor && all.length < limit);
  return all;
}

export async function createRecord<T extends Record<string, unknown>>(
  collection: string,
  data: T
): Promise<SiteRecord<T>> {
  const res = await fetch(`${BASE}/${collection}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(data),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || body.message || `Create failed (${res.status})`);
  return body.record as SiteRecord<T>;
}

export async function updateRecord<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  data: Partial<T>
): Promise<SiteRecord<T>> {
  const res = await fetch(`${BASE}/${collection}/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body.error || body.message || `Update failed (${res.status})`);
  return body.record as SiteRecord<T>;
}

export async function deleteRecord(collection: string, id: string): Promise<void> {
  const res = await fetch(`${BASE}/${collection}/${id}`, { method: "DELETE" });
  if (res.ok || res.status === 204) return;
  const body = await parseJson(res).catch(() => ({}));
  throw new Error(
    (body as { error?: string; message?: string }).error ||
      (body as { message?: string }).message ||
      `Delete failed (${res.status})`
  );
}

export type MemberData = {
  email: string;
  name: string;
  password_hash: string;
  password_salt: string;
  role: string;
  phone?: string;
  subscription_status?: string;
  subscription_id?: string;
  /** Benefits continue until this date when status is cancelling */
  period_end?: string;
  emergency_notes?: string;
  /** Opted into subscriber community chat */
  chat_joined?: boolean;
  /** Email already sent after silent chat revoke */
  chat_revoked_notified?: boolean;
  /** Browser/PWA notify on general messages */
  chat_notify_messages?: boolean;
  /** Browser/PWA notify on announcement channel */
  chat_notify_announcements?: boolean;
  /** Profile photo (compressed data URL or external URL) — used in studio + community chat */
  avatar_url?: string;
  /** Opted into general Boots N Boogie mailing list (marketing / news) */
  mailing_list_opt_in?: boolean;
};

export type ChatMessageData = {
  channel_id: string;
  channel_slug?: string;
  member_id: string;
  member_email: string;
  member_name: string;
  member_role?: string;
  body: string;
  record_status: string;
};

export type BookingData = {
  member_id: string;
  member_email: string;
  member_name: string;
  class_id: string;
  class_title: string;
  session_date: string;
  session_time: string;
  amount_gbp: number;
  payment_status: string;
  payment_method?: string;
  record_status: string;
  /** Marked present by admin — free weekly only “used” if true (or session still upcoming) */
  attended?: boolean;
  notes?: string;
  franchisee_id?: string;
  franchisee_town?: string;
  venue_name?: string;
};

export type SubscriptionData = {
  member_id: string;
  member_email: string;
  member_name: string;
  plan_id: string;
  amount_gbp: number;
  record_status: string;
  account_name: string;
  /** Full UK account number for Direct Debit setup */
  account_number: string;
  account_last4?: string;
  sort_code: string;
  mandate_ref: string;
  payment_method?: string;
  started_at?: string;
  next_collection_at?: string;
  cancelled_at?: string;
  /** When membership was requested to cancel; benefits last until this date (end of month) */
  period_end?: string;
};

export type SocialRegData = {
  member_id: string;
  member_email: string;
  member_name: string;
  event_id: string;
  event_title: string;
  ticket_type: string;
  plus_one_name?: string;
  plus_one_email?: string;
  plus_one_first_timer?: boolean;
  amount_gbp: number;
  payment_status: string;
  /** pay_at_door | paypal | complimentary | membership */
  payment_method?: string;
  /** e.g. PayPal order id */
  payment_ref?: string;
  record_status: string;
  checked_in?: boolean;
};

export type ShopOrderData = {
  member_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  items_json: string;
  total_gbp: number;
  record_status: string;
  payment_status: string;
  fulfillment_notes?: string;
};

export type { CmsContentData, ProductData, FranchiseeData, FranchiseEnquiryData } from "./cms-types";
