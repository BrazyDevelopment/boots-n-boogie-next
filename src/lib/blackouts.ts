/** Studio-wide non-teaching dates. Subscribers still pay £40 these months. */

/** Fixed MM-DD blackouts (every year) */
const FIXED_MMDD = new Set([
  "01-01",
  "01-02",
  "01-17",
  "02-14",
  "02-22",
  "05-07",
  "05-08",
  "05-09",
  "05-10",
  "05-11",
  "09-23",
  "09-24",
  "09-25",
  "09-26",
  "09-27",
  "10-31",
  "11-05",
  "12-24",
  "12-25",
  "12-26",
  "12-30",
]);

/** Anonymous Gregorian Easter Sunday (YYYY-MM-DD) for a year */
export function easterSunday(year: number): string {
  // Meeus/Jones/Butcher algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function isBlackoutDate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const [y, mm, dd] = isoDate.split("-");
  const md = `${mm}-${dd}`;
  if (FIXED_MMDD.has(md)) return true;
  const year = Number(y);
  if (isoDate === easterSunday(year)) return true;
  return false;
}

export const BLACKOUT_NOTE =
  "No classes on studio blackout dates (incl. New Year, Valentine’s, Easter Sunday, selected May/Sept, Halloween, Bonfire Night, Christmas period, etc.). Membership is still £40/month — non-negotiable.";
