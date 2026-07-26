import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin, PoundSterling, ArrowRight } from "lucide-react";
import { VENUES, type CLASSES } from "@/lib/data";

type ClassItem = (typeof CLASSES)[number];

const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

export function ClassCard({ item }: { item: ClassItem }) {
  return (
    <article className="card-surface group flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-transparent to-transparent" />
        {item.badge && (
          <span className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-bg">
            {item.badge}
          </span>
        )}
        <span className="absolute bottom-4 left-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs font-semibold text-cream backdrop-blur">
          {item.level}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-2xl font-bold tracking-tight">{item.title}</h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{item.description}</p>
        <ul className="mt-4 space-y-2 text-sm text-cream">
          {item.slots.map((slot) => {
            const venue = VENUES[slot.venueId];
            return (
              <li key={`${slot.dayOfWeek}-${slot.time}`} className="rounded-lg border border-line bg-bg/40 p-3">
                <div className="inline-flex items-center gap-1.5 font-semibold">
                  <Clock size={14} className="text-accent" />
                  {DAY_NAMES[slot.dayOfWeek]} {slot.time}
                </div>
                <div className="mt-1 inline-flex items-start gap-1.5 text-xs text-muted">
                  <MapPin size={12} className="mt-0.5 shrink-0 text-accent" />
                  {venue.name}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cream">
          <PoundSterling size={15} className="text-accent" />
          {item.price} per class · {item.duration}
        </div>
        <Link href={`/book/?class=${item.id}`} className="btn-primary mt-6 w-full">
          Book this class
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}
