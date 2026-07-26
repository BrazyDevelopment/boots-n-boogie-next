"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { loadEvents, type BnBEvent } from "@/lib/events";

export default function EventsPage() {
  const [events, setEvents] = useState<BnBEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await loadEvents();
        if (!cancelled) setEvents(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load events");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const open = events.filter((e) => e.status === "open");
  const past = events.filter((e) => e.status !== "open");

  return (
    <>
      <PageHero
        label="Events"
        title="Socials, workshops & big nights out"
        description="Quarterly socials, summer workshops and community nights at The Arnold House, Rugby. £40 members get free social entry, a free +1, and one free class every week."
      >
        <Link href="/subscribe/" className="btn-primary">
          £40 social membership
        </Link>
      </PageHero>

      <section className="py-16">
        <div className="container-page space-y-8">
          <h2 className="font-display text-3xl tracking-wide">Open for booking</h2>
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="animate-spin" size={16} /> Loading events…
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!loading && open.length === 0 && (
            <p className="text-muted">No open events right now — check back soon.</p>
          )}
          {open.map((item, i) => (
            <Reveal key={item.id} delay={i * 0.06}>
              <EventCard item={item} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-bg-elevated py-16">
        <div className="container-page space-y-8">
          <h2 className="font-display text-3xl tracking-wide">Past & closed events</h2>
          {!loading && past.length === 0 && (
            <p className="text-muted">No past events listed yet.</p>
          )}
          {past.map((item, i) => (
            <Reveal key={item.id} delay={i * 0.06}>
              <EventCard item={item} />
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand
        title="Never miss a quarterly social"
        body="Monthly Direct Debit membership unlocks free social entry and a free first-timer +1."
      />
    </>
  );
}
