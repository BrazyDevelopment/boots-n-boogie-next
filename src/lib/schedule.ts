import { CLASSES, VENUES } from "./data";
import { isBlackoutDate } from "./blackouts";
import { formatDateUKWithWeekday } from "./dates";
import type { FranchiseClassSlot } from "./cms-types";

export type ClassSession = {
  key: string;
  classId: string;
  title: string;
  level: string;
  date: string; // YYYY-MM-DD
  time: string;
  endTime: string;
  duration: string;
  price: number;
  image: string;
  label: string;
  venueName: string;
  venueAddress: string;
  venueMapsUrl: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatLabel(d: Date, time: string, venueName: string) {
  return `${formatDateUKWithWeekday(d)} · ${time} · ${venueName}`;
}

/** Optional set of cancelled session keys or date|classId|time strings */
export function upcomingSessions(
  weeks = 8,
  cancelledKeys: Set<string> = new Set()
): ClassSession[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = addDays(today, weeks * 7);
  const out: ClassSession[] = [];

  for (const cls of CLASSES) {
    for (const slot of cls.slots) {
      const venue = VENUES[slot.venueId];
      let d = new Date(today);
      const delta = (slot.dayOfWeek - d.getDay() + 7) % 7;
      d = addDays(d, delta === 0 ? 0 : delta);
      while (d <= end) {
        const date = toISODate(d);
        const key = `${cls.id}_${date}_${slot.time.replace(":", "")}`;
        if (!isBlackoutDate(date) && !cancelledKeys.has(key) && !cancelledKeys.has(`${date}|${cls.id}|${slot.time}`)) {
          out.push({
            key,
            classId: cls.id,
            title: cls.title,
            level: cls.level,
            date,
            time: slot.time,
            endTime: slot.endTime,
            duration: cls.duration,
            price: cls.price,
            image: cls.image,
            label: formatLabel(d, slot.time, venue.name),
            venueName: venue.name,
            venueAddress: venue.address,
            venueMapsUrl: venue.mapsUrl,
          });
        }
        d = addDays(d, 7);
      }
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export function sessionsForClass(classId: string, weeks = 8) {
  return upcomingSessions(weeks).filter((s) => s.classId === classId);
}

/**
 * Build bookable sessions from an arbitrary weekly slot list
 * (HQ satellite towns or franchise territories).
 */
export function upcomingSessionsFromSlots(
  slots: FranchiseClassSlot[],
  weeks = 8,
  cancelledKeys: Set<string> = new Set(),
  keyPrefix = "loc"
): ClassSession[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = addDays(today, weeks * 7);
  const out: ClassSession[] = [];

  for (const slot of slots) {
    let d = new Date(today);
    const delta = (slot.dayOfWeek - d.getDay() + 7) % 7;
    d = addDays(d, delta === 0 ? 0 : delta);
    while (d <= end) {
      const date = toISODate(d);
      const classId = slot.classId || "class";
      const key = `${keyPrefix}_${classId}_${date}_${(slot.time || "1900").replace(":", "")}`;
      if (
        !isBlackoutDate(date) &&
        !cancelledKeys.has(key) &&
        !cancelledKeys.has(`${date}|${classId}|${slot.time}`)
      ) {
        out.push({
          key,
          classId,
          title: slot.title,
          level: slot.level,
          date,
          time: slot.time,
          endTime: slot.endTime || "",
          duration: slot.duration || "",
          price: slot.price,
          image: slot.image || "/images/class-beginner.jpg",
          label: formatLabel(d, slot.time, slot.venueName || "Venue"),
          venueName: slot.venueName || "",
          venueAddress: slot.venueAddress || "",
          venueMapsUrl: "",
        });
      }
      d = addDays(d, 7);
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

/** Monday-start week containing a YYYY-MM-DD date */
export function weekBoundsForDate(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00");
  const day = (d.getDay() + 6) % 7; // Mon=0
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  const end = addDays(start, 7);
  return { start, end };
}
