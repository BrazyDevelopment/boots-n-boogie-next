import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";
import type { EVENTS } from "@/lib/data";
import { formatDateRangeUK } from "@/lib/dates";

type EventItem = (typeof EVENTS)[number];

export function EventCard({ item }: { item: EventItem }) {
  const open = item.status === "open";
  const dateText = formatDateRangeUK(item.dateISO, item.endDateISO, item.dateLabel);
  return (
    <article className="card-surface group grid overflow-hidden md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="relative min-h-[220px] md:min-h-full">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 40vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-card/80 via-transparent to-transparent md:bg-gradient-to-r" />
      </div>
      <div className="flex flex-col p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              open ? "bg-accent/15 text-accent" : "bg-white/8 text-muted"
            }`}
          >
            {open ? "Tickets available" : "Registration closed"}
          </span>
          {item.isSocial && (
            <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              Quarterly social
            </span>
          )}
          <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">
            {item.level}
          </span>
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold tracking-tight md:text-3xl">
          {item.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">{item.blurb}</p>
        <ul className="mt-5 space-y-2 text-sm text-cream">
          <li className="inline-flex items-start gap-2">
            <CalendarDays size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              {dateText} · {item.time}
              <br />
              <span className="text-muted">{item.doors}</span>
            </span>
          </li>
          <li className="inline-flex items-start gap-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>
              {item.venue}
              <br />
              <span className="text-muted">{item.address}</span>
            </span>
          </li>
        </ul>
        <Link
          href={`/events/${item.id}/`}
          className={`mt-6 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${
            open
              ? "bg-accent text-bg hover:bg-accent-hover"
              : "border border-line bg-white/5 text-foreground hover:bg-white/10"
          }`}
        >
          {open ? "Book / register" : "View details"}
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}
