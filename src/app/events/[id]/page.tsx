import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { EVENTS } from "@/lib/data";
import { formatDateRangeUK } from "@/lib/dates";
import { EventRegister } from "@/components/EventRegister";

export function generateStaticParams() {
  return EVENTS.map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = EVENTS.find((e) => e.id === id);
  return { title: event?.title || "Event" };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = EVENTS.find((e) => e.id === id);
  if (!event) notFound();

  return (
    <>
      <section className="relative min-h-[42vh] overflow-hidden pt-20">
        <Image src={event.image} alt={event.title} fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/40" />
        <div className="container-page relative flex min-h-[42vh] flex-col justify-end pb-12 pt-28">
          <Link href="/events/" className="text-sm font-semibold text-accent">
            ← All events
          </Link>
          <h1 className="mt-3 font-display text-4xl tracking-wide md:text-6xl">{event.title}</h1>
          <p className="mt-3 max-w-2xl text-muted">{event.blurb}</p>
        </div>
      </section>

      <section className="py-14">
        <div className="container-page grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex flex-wrap gap-4 text-sm text-cream">
              <span className="inline-flex items-start gap-2">
                <CalendarDays size={18} className="text-accent" />
                {formatDateRangeUK(event.dateISO, event.endDateISO, event.dateLabel)} · {event.time}
              </span>
              <span className="inline-flex items-start gap-2">
                <MapPin size={18} className="text-accent" />
                {event.venue}, {event.address}
              </span>
            </div>
            <h2 className="mt-10 font-display text-3xl tracking-wide">About</h2>
            <ul className="mt-4 space-y-2 text-muted">
              {event.details.map((d) => (
                <li key={d}>· {d}</li>
              ))}
            </ul>
            <h2 className="mt-10 font-display text-3xl tracking-wide">Tickets</h2>
            <ul className="mt-4 space-y-2">
              {event.tickets.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-bg-card px-4 py-3 text-sm"
                >
                  <span>{t.name}</span>
                  <span className="font-bold text-accent">£{t.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            {event.isSocial && (
              <p className="mt-6 text-sm text-muted">
                <strong className="text-cream">£40 members:</strong> free entry to this quarterly
                social and a free +1. Membership also includes one free class every week — cancel any
                time.
              </p>
            )}
          </div>
          <EventRegister event={event} />
        </div>
      </section>
    </>
  );
}
