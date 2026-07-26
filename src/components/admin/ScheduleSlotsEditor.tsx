"use client";

import { CLASSES, SITE } from "@/lib/data";
import { emptyClassSlot, type FranchiseClassSlot } from "@/lib/cms-types";
import { Field, inputCls } from "@/components/admin/AdminChrome";

const DAY_OPTIONS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

type VenueOpt = { name: string; address: string };

export function ScheduleSlotsEditor({
  slots,
  onChange,
  venues,
}: {
  slots: FranchiseClassSlot[];
  onChange: (slots: FranchiseClassSlot[]) => void;
  venues: VenueOpt[];
}) {
  function update(i: number, patch: Partial<FranchiseClassSlot>) {
    const next = slots.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
  }

  function add() {
    const firstVenue = venues[0];
    const cls = CLASSES[0];
    onChange([
      ...slots,
      emptyClassSlot({
        classId: cls?.id || "ultra-beginner",
        title: cls?.title || "Class",
        level: cls?.level || "Beginner",
        price: cls?.price ?? SITE.classPrice,
        image: cls?.image || "/images/class-beginner.jpg",
        venueName: firstVenue?.name || SITE.venue,
        venueAddress: firstVenue?.address || SITE.addressShort,
      }),
    ]);
  }

  function remove(i: number) {
    onChange(slots.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Weekly class schedule</p>
        <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={add}>
          Add class slot
        </button>
      </div>
      {slots.length === 0 && (
        <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
          No classes listed yet. Add at least one weekly slot so this town shows times on /classes.
        </p>
      )}
      {slots.map((slot, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-line bg-bg/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-cream">Slot {i + 1}</p>
            <button
              type="button"
              className="text-xs font-bold text-red-400"
              onClick={() => remove(i)}
            >
              Remove
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Class template">
              <select
                className={inputCls}
                value={slot.classId}
                onChange={(e) => {
                  const cls = CLASSES.find((c) => c.id === e.target.value);
                  update(i, {
                    classId: e.target.value,
                    title: cls?.title || slot.title,
                    level: cls?.level || slot.level,
                    price: cls?.price ?? slot.price,
                    image: cls?.image || slot.image,
                    duration: cls?.duration || slot.duration,
                  });
                }}
              >
                {CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
                {!CLASSES.some((c) => c.id === slot.classId) && (
                  <option value={slot.classId}>{slot.title || slot.classId}</option>
                )}
              </select>
            </Field>
            <Field label="Display title">
              <input
                className={inputCls}
                value={slot.title}
                onChange={(e) => update(i, { title: e.target.value })}
              />
            </Field>
            <Field label="Level">
              <input
                className={inputCls}
                value={slot.level}
                onChange={(e) => update(i, { level: e.target.value })}
              />
            </Field>
            <Field label="Price £">
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={slot.price}
                onChange={(e) => update(i, { price: Number(e.target.value) })}
              />
            </Field>
            <Field label="Day">
              <select
                className={inputCls}
                value={slot.dayOfWeek}
                onChange={(e) => update(i, { dayOfWeek: Number(e.target.value) })}
              >
                {DAY_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start time">
              <input
                className={inputCls}
                value={slot.time}
                onChange={(e) => update(i, { time: e.target.value })}
                placeholder="19:00"
              />
            </Field>
            <Field label="End time">
              <input
                className={inputCls}
                value={slot.endTime}
                onChange={(e) => update(i, { endTime: e.target.value })}
                placeholder="20:30"
              />
            </Field>
            <Field label="Duration label">
              <input
                className={inputCls}
                value={slot.duration || ""}
                onChange={(e) => update(i, { duration: e.target.value })}
                placeholder="1 hr 30 min"
              />
            </Field>
            <Field label="Venue">
              <select
                className={inputCls}
                value={
                  venues.some((v) => v.name === slot.venueName) ? slot.venueName : "__custom__"
                }
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    update(i, { venueName: slot.venueName || "" });
                    return;
                  }
                  const v = venues.find((x) => x.name === e.target.value);
                  update(i, {
                    venueName: e.target.value,
                    venueAddress: v?.address || slot.venueAddress,
                  });
                }}
              >
                {venues.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
                <option value="__custom__">Other / custom…</option>
              </select>
            </Field>
            <Field label="Venue name (if custom)">
              <input
                className={inputCls}
                value={slot.venueName}
                onChange={(e) => update(i, { venueName: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Venue address">
                <input
                  className={inputCls}
                  value={slot.venueAddress}
                  onChange={(e) => update(i, { venueAddress: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
