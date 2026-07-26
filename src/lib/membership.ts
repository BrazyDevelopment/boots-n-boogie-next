/** Membership benefit helpers */

import { CLASSES, SITE } from "@/lib/data";
import {
  listRecords,
  updateRecord,
  type BookingData,
} from "@/lib/sitedata";

export function endOfMonthISO(from = new Date()): string {
  const y = from.getFullYear();
  const m = from.getMonth();
  const last = new Date(y, m + 1, 0);
  const mm = String(last.getMonth() + 1).padStart(2, "0");
  const dd = String(last.getDate()).padStart(2, "0");
  return `${last.getFullYear()}-${mm}-${dd}`;
}

/** Active membership OR cancelling but still within paid period (end of month). */
export function hasMembershipBenefits(
  subscriptionStatus?: string | null,
  periodEndISO?: string | null
): boolean {
  if (subscriptionStatus === "active") return true;
  if (subscriptionStatus === "cancelling" && periodEndISO) {
    const end = new Date(periodEndISO + "T23:59:59");
    return Date.now() <= end.getTime();
  }
  return false;
}

export const EVENT_SUBSCRIBER_DISCOUNT = 0.2; // 20% off temporary events

/** Calendar day after YYYY-MM-DD (local). */
export function dayAfterISO(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  d.setDate(d.getDate() + 1);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function dropInPriceForClass(classId?: string): number {
  const cls = CLASSES.find((c) => c.id === classId);
  return cls?.price ?? SITE.classPrice;
}

/**
 * When membership ends, free member bookings on/after chargeFromDate
 * (inclusive) become full-price pay-at-class. Sessions still covered by
 * the paid month (before chargeFromDate) stay complimentary.
 */
export async function convertFreeBookingsAfterBenefits(opts: {
  memberId: string;
  memberEmail: string;
  /** First date without free-class benefits (YYYY-MM-DD), inclusive. */
  chargeFromDate: string;
}): Promise<{ converted: number; bookingIds: string[] }> {
  const email = opts.memberEmail.toLowerCase();
  const bookings = await listRecords<BookingData>("bookings", 500);
  const mine = bookings.filter(
    (b) =>
      b.data.member_id === opts.memberId ||
      (b.data.member_email || "").toLowerCase() === email
  );

  const toConvert = mine.filter((b) => {
    if (b.data.record_status === "cancelled") return false;
    if (b.data.payment_method !== "membership_free") return false;
    if (b.data.payment_status === "paid") return false;
    // Session date on or after chargeFromDate loses free entitlement
    return b.data.session_date >= opts.chargeFromDate;
  });

  const bookingIds: string[] = [];
  for (const b of toConvert) {
    const price = dropInPriceForClass(b.data.class_id);
    const note =
      `${b.data.notes || ""} · Converted from free member class to pay-at-class after membership cancel`.trim();
    await updateRecord<BookingData>("bookings", b.id, {
      amount_gbp: price,
      payment_method: "pay_at_class",
      payment_status: "pay_at_class",
      notes: note.slice(0, 500),
    });
    bookingIds.push(b.id);
  }

  return { converted: bookingIds.length, bookingIds };
}
