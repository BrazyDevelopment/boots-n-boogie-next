"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ArrowRight, MapPin } from "lucide-react";
import { ClassCard } from "@/components/ClassCard";
import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { CLASSES, FIRST_CLASS_GUIDE, SITE, VENUES } from "@/lib/data";
import {
  parseJsonSafe,
  type CmsContentData,
  type FranchiseClassSlot,
  type FranchiseeData,
  type HqLocationBody,
} from "@/lib/cms-types";
import { listRecords, type SiteRecord } from "@/lib/sitedata";

const DAY_NAMES = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

type TownOption =
  | { kind: "hq"; id: "rugby"; label: string }
  | {
      kind: "hq_location";
      id: string;
      label: string;
      location: SiteRecord<CmsContentData>;
      body: HqLocationBody;
    }
  | { kind: "franchisee"; id: string; label: string; franchisee: SiteRecord<FranchiseeData> };

function ScheduleCards({
  slots,
  bookHref,
}: {
  slots: FranchiseClassSlot[];
  bookHref: (slot: FranchiseClassSlot) => string;
}) {
  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2">
      {slots.map((slot, i) => (
        <article
          key={`${slot.classId}-${slot.dayOfWeek}-${slot.time}-${i}`}
          className="card-surface overflow-hidden"
        >
          {slot.image && (
            <div className="relative aspect-[16/9]">
              <Image src={slot.image} alt="" fill className="object-cover" />
            </div>
          )}
          <div className="p-6">
            <p className="text-xs font-bold uppercase tracking-wider text-accent">{slot.level}</p>
            <h3 className="mt-1 font-display text-2xl tracking-wide">{slot.title}</h3>
            <p className="mt-3 text-sm text-cream">
              <strong>
                {DAY_NAMES[slot.dayOfWeek] || "Day"} {slot.time}
                {slot.endTime ? ` – ${slot.endTime}` : ""}
              </strong>
            </p>
            <p className="mt-2 flex items-start gap-2 text-sm text-muted">
              <MapPin size={16} className="mt-0.5 shrink-0 text-accent" />
              {slot.venueName}
              <br />
              {slot.venueAddress}
            </p>
            <p className="mt-3 font-semibold text-accent">£{slot.price} per class</p>
            <Link href={bookHref(slot)} className="btn-primary mt-5 w-full !py-2 text-sm">
              Book this class
              <ArrowRight size={16} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function ClassesPage() {
  const [franchisees, setFranchisees] = useState<SiteRecord<FranchiseeData>[]>([]);
  const [hqLocations, setHqLocations] = useState<SiteRecord<CmsContentData>[]>([]);
  const [townId, setTownId] = useState("rugby");

  useEffect(() => {
    Promise.all([
      listRecords<FranchiseeData>("franchisees", 100),
      listRecords<CmsContentData>("cms_content", 200),
    ])
      .then(([fr, cms]) => {
        setFranchisees(fr.filter((f) => f.data.record_status === "active"));
        setHqLocations(
          cms.filter(
            (c) =>
              c.data.content_type === "hq_location" &&
              c.data.published &&
              c.data.record_status === "active"
          )
        );
      })
      .catch(() => undefined);
  }, []);

  const towns: TownOption[] = useMemo(() => {
    const hq: TownOption = {
      kind: "hq",
      id: "rugby",
      label: "Rugby (HQ) — Warwickshire",
    };
    const satellites: TownOption[] = hqLocations
      .map((loc) => {
        const body = parseJsonSafe<HqLocationBody>(loc.data.body_json, { schedule: [] });
        const region = body.region || loc.data.summary || "";
        return {
          kind: "hq_location" as const,
          id: `hq:${loc.id}`,
          label: `${loc.data.title}${region ? `, ${region}` : ""} — Boots N Boogie HQ`,
          location: loc,
          body,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    const franchiseTowns: TownOption[] = franchisees
      .map((f) => ({
        kind: "franchisee" as const,
        id: f.id,
        label: `${f.data.town_city}${f.data.region ? `, ${f.data.region}` : ""} — ${f.data.full_name}`,
        franchisee: f,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [hq, ...satellites, ...franchiseTowns];
  }, [franchisees, hqLocations]);

  const selected = towns.find((t) => t.id === townId) || towns[0];

  return (
    <>
      <PageHero
        label="Classes"
        title="Find classes near you"
        description="Select your town or city. Rugby is our home HQ; we also run company classes in other towns, and franchise studios list their own venues and times. All bookings run through this website."
      >
        <div className="max-w-md">
          <label className="block text-sm font-semibold text-cream">
            Your town / city
            <select
              value={townId}
              onChange={(e) => setTownId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-line bg-bg-card px-4 py-3 text-base font-normal text-foreground"
            >
              {towns.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </PageHero>

      {selected?.kind === "hq" && (
        <>
          <section className="py-16">
            <div className="container-wide">
              <Reveal>
                <p className="section-label">Rugby HQ schedule</p>
                <h2 className="mt-2 font-display text-3xl tracking-wide">Current weekly classes</h2>
              </Reveal>
              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {CLASSES.map((item, i) => (
                  <Reveal key={item.id} delay={i * 0.08}>
                    <ClassCard item={item} />
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section className="border-y border-line bg-bg-elevated py-16">
            <div className="container-page">
              <div className="grid gap-6 md:grid-cols-3">
                {CLASSES.map((item) => (
                  <div key={item.id} className="card-surface p-6">
                    <h3 className="font-display text-2xl tracking-wide">{item.title}</h3>
                    <p className="mt-2 text-sm font-semibold text-accent">
                      {item.level} · {item.duration} · £{item.price}
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-cream">
                      {item.slots.map((s) => {
                        const venue = VENUES[s.venueId];
                        return (
                          <li key={`${s.dayOfWeek}-${s.time}`}>
                            <strong>
                              {DAY_NAMES[s.dayOfWeek]} {s.time}
                            </strong>
                            <div className="text-xs text-muted">
                              {venue.name} · {venue.address}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <ul className="mt-4 space-y-2">
                      {item.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2 text-sm text-muted">
                          <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                          {h}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/book/?class=${item.id}`}
                      className="btn-primary mt-6 w-full !py-2 text-sm"
                    >
                      Book
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {selected?.kind === "hq_location" && (
        <section className="py-16">
          <div className="container-page">
            <Reveal>
              <p className="section-label">HQ company studio</p>
              <h2 className="mt-2 font-display text-3xl tracking-wide">
                {selected.location.data.title}
              </h2>
              <p className="mt-2 text-muted">
                {selected.body.blurb ||
                  `Boots N Boogie company classes in ${selected.location.data.title}${
                    selected.body.region ? `, ${selected.body.region}` : ""
                  }. Run by HQ — not a franchise.`}
              </p>
            </Reveal>

            {(selected.body.schedule || []).length === 0 ? (
              <div className="card-surface mt-8 p-8 text-sm text-muted">
                <p>Weekly times for this town are being finalised. Check back soon, or contact us.</p>
                <Link href="/contact/" className="btn-secondary mt-6 inline-flex">
                  Contact HQ
                </Link>
              </div>
            ) : (
              <ScheduleCards
                slots={selected.body.schedule}
                bookHref={(slot) =>
                  `/book/?class=${encodeURIComponent(slot.classId)}&location=${encodeURIComponent(
                    selected.location.id
                  )}&town=${encodeURIComponent(selected.location.data.title)}&venue=${encodeURIComponent(
                    slot.venueName
                  )}`
                }
              />
            )}
          </div>
        </section>
      )}

      {selected?.kind === "franchisee" && (
        <section className="py-16">
          <div className="container-page">
            <Reveal>
              <p className="section-label">Franchise territory</p>
              <h2 className="mt-2 font-display text-3xl tracking-wide">
                {selected.franchisee.data.town_city}
              </h2>
              <p className="mt-2 text-muted">
                Led by {selected.franchisee.data.full_name}
                {selected.franchisee.data.territory
                  ? ` · ${selected.franchisee.data.territory}`
                  : ""}
                . Bookings are taken on this site so HQ can support every studio.
              </p>
            </Reveal>

            {(() => {
              const franchiseSchedule = parseJsonSafe<FranchiseClassSlot[]>(
                selected.franchisee.data.schedule_json || "[]",
                []
              );
              if (franchiseSchedule.length === 0) {
                return (
                  <div className="card-surface mt-8 p-8 text-sm text-muted">
                    <p>
                      This franchisee hasn&apos;t published a weekly schedule yet. Check back soon,
                      or contact HQ.
                    </p>
                    <Link href="/book/" className="btn-secondary mt-6 inline-flex">
                      Browse Rugby HQ bookings
                    </Link>
                  </div>
                );
              }
              return (
                <ScheduleCards
                  slots={franchiseSchedule}
                  bookHref={(slot) =>
                    `/book/?class=${encodeURIComponent(slot.classId)}&franchisee=${encodeURIComponent(
                      selected.id
                    )}&town=${encodeURIComponent(
                      selected.franchisee.data.town_city
                    )}&venue=${encodeURIComponent(slot.venueName)}`
                  }
                />
              );
            })()}
          </div>
        </section>
      )}

      <section className="py-20">
        <div className="container-page">
          <Reveal>
            <p className="section-label">First class guide</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl tracking-wide md:text-5xl">
              {FIRST_CLASS_GUIDE.title}
            </h2>
            <p className="mt-4 max-w-2xl text-muted">{FIRST_CLASS_GUIDE.excerpt}</p>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FIRST_CLASS_GUIDE.sections.map((section, i) => (
              <Reveal key={section.title} delay={i * 0.05}>
                <div className="card-surface h-full p-6">
                  <span className="font-display text-3xl text-accent/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 font-display text-2xl tracking-wide">{section.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{section.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/book/" className="btn-primary">
                Book your first class
              </Link>
              <Link href="/contact/" className="btn-secondary">
                Ask a question
                <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Your first shuffle starts here"
        body={`Pick beginner if you're brand new — ${SITE.name} meets you where you are. £${SITE.classPrice} drop-in.`}
      />
    </>
  );
}
