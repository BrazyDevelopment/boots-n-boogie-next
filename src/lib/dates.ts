/**
 * Display dates as dd-mm-yyyy (UK). Storage stays ISO YYYY-MM-DD where needed.
 */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Parse YYYY-MM-DD, ISO datetime, or Date → local calendar Date (noon for date-only). */
export function parseDateInput(input: string | Date | null | undefined): Date | null {
  if (input == null || input === "") return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }
  const s = String(input).trim();
  // Already dd-mm-yyyy
  const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // YYYY-MM-DD (date only)
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format any date-like value as dd-mm-yyyy. Returns fallback if unparseable. */
export function formatDateUK(
  input: string | Date | null | undefined,
  fallback = "—"
): string {
  const d = parseDateInput(input);
  if (!d) return input ? String(input) : fallback;
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** e.g. "Mon 20-07-2026" */
export function formatDateUKWithWeekday(
  input: string | Date | null | undefined,
  fallback = "—"
): string {
  const d = parseDateInput(input);
  if (!d) return input ? String(input) : fallback;
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  return `${weekday} ${formatDateUK(d)}`;
}

/** Single date or range from ISO start/end → dd-mm-yyyy (or "dd-mm-yyyy – dd-mm-yyyy"). */
export function formatDateRangeUK(
  startISO?: string | null,
  endISO?: string | null,
  fallbackLabel?: string
): string {
  if (!startISO && fallbackLabel) return fallbackLabel;
  const start = formatDateUK(startISO);
  if (endISO && endISO !== startISO) {
    return `${start} – ${formatDateUK(endISO)}`;
  }
  return start;
}
