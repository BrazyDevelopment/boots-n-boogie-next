import type { Metadata } from "next";
import { EventCard } from "@/components/EventCard";
import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { EVENTS } from "@/lib/data";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Events & Socials",
  description:
    "All Boots N Boogie line dance socials, summer workshops and kids sessions in Rugby — book online.",
};

export default function EventsPage() {
  const open = EVENTS.filter((e) => e.status === "open");
  const past = EVENTS.filter((e) => e.status !== "open");

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
          {open.length === 0 && <p className="text-muted">No open events right now — check back soon.</p>}
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
