import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Music2,
  Sparkles,
  Users,
  Ticket,
} from "lucide-react";
import { ClassCard } from "@/components/ClassCard";
import { CtaBand } from "@/components/CtaBand";
import { EventCard } from "@/components/EventCard";
import { FloorGallery } from "@/components/FloorGallery";
import { FranchiseTeaser } from "@/components/FranchiseTeaser";
import { Reveal } from "@/components/Reveal";
import {
  CLASSES,
  EVENTS,
  MISSION_QUOTE,
  PRODUCTS,
  SITE,
  STATS,
  TEAM,
} from "@/lib/data";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[100svh] items-end overflow-hidden pb-16 pt-28 md:items-center md:pb-24">
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/blog-social.jpg"
            alt="Boots N Boogie line dance social — dancers on the floor"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-bg/50" />
          <div className="grain" />
        </div>

        <div className="container-page w-full">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-accent">
              <Sparkles size={14} />
              Line dancing · Rugby & Midlands
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 max-w-[12ch] font-display text-6xl leading-[0.92] tracking-wide text-foreground md:text-8xl lg:text-9xl">
              Kick up your <span className="text-accent">heels</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 max-w-xl text-lg text-muted md:text-xl">
              {SITE.description}
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/book/" className="btn-primary text-base">
                <Ticket size={18} />
                Book a class
              </Link>
              <Link href="/classes/" className="btn-secondary text-base">
                View class levels
                <ArrowRight size={18} />
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.32}>
            <div className="mt-14 grid grid-cols-2 gap-6 border-t border-line pt-8 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-3xl tracking-wide text-accent md:text-4xl">
                    {s.num}
                  </div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted md:text-sm">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Why us */}
      <section className="py-24">
        <div className="container-page">
          <Reveal>
            <p className="section-label">Why Boots N Boogie</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl tracking-wide md:text-5xl">
              Community first. Perfection never required.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Users,
                title: "No partner needed",
                body: "Most dancers walk in alone and leave with new friends. Line dancing is a group sport — we move together.",
              },
              {
                icon: Music2,
                title: "Steps taught clearly",
                body: "Every dance broken down, repeated, and coached with patience. From first shuffle to improver flow.",
              },
              {
                icon: Heart,
                title: "Family-run energy",
                body: "Run by a family of dancers who care about laughs, confidence and belonging.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.08}>
                <div className="card-surface h-full p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                    <item.icon size={22} />
                  </div>
                  <h3 className="mt-5 font-display text-2xl tracking-wide">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Classes */}
      <section className="border-y border-line bg-bg-elevated py-24">
        <div className="container-wide">
          <div className="container-page !mx-0 mb-12 flex flex-wrap items-end justify-between gap-6 px-0">
            <Reveal>
              <p className="section-label">Class schedule</p>
              <h2 className="mt-3 font-display text-4xl tracking-wide md:text-5xl">
                Find your groove
              </h2>
              <p className="mt-3 max-w-xl text-muted">
                Whether you&apos;re a first-timer or a seasoned shuffler, our classes get your boots
                boogeying to the best beats in town.
              </p>
            </Reveal>
            <Reveal>
              <Link href="/classes/" className="btn-secondary">
                All classes
                <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {CLASSES.map((item, i) => (
              <Reveal key={item.id} delay={i * 0.08}>
                <ClassCard item={item} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Events */}
      <section className="py-24">
        <div className="container-page">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <Reveal>
              <p className="section-label">Upcoming socials</p>
              <h2 className="mt-3 font-display text-4xl tracking-wide md:text-5xl">
                Dance the night away
              </h2>
            </Reveal>
            <Reveal>
              <Link href="/events/" className="btn-secondary">
                All events
                <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
          <div className="space-y-6">
            {EVENTS.map((item, i) => (
              <Reveal key={item.id} delay={i * 0.08}>
                <EventCard item={item} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Mission + Team */}
      <section className="relative overflow-hidden border-y border-line py-24">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(232,160,23,0.08),transparent_50%)]" />
        <div className="container-page">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <p className="section-label">Our story</p>
              <h2 className="mt-3 font-display text-4xl tracking-wide md:text-5xl">
                Built on friendship, not perfection
              </h2>
              <blockquote className="mt-8 border-l-4 border-accent pl-6 text-lg leading-relaxed text-cream/90">
                “{MISSION_QUOTE}”
              </blockquote>
              <Link href="/about/" className="btn-secondary mt-8">
                Meet the team
                <ArrowRight size={16} />
              </Link>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2">
              {TEAM.map((member, i) => (
                <Reveal key={member.name} delay={i * 0.1}>
                  <div className="card-surface overflow-hidden">
                    <div className="relative aspect-[4/5]">
                      <Image
                        src={member.image}
                        alt={member.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 280px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-transparent to-transparent" />
                    </div>
                    <div className="p-5">
                      <h3 className="font-display text-2xl tracking-wide">{member.name}</h3>
                      <p className="text-sm font-semibold text-accent">{member.role}</p>
                      <p className="mt-2 line-clamp-4 text-sm text-muted">{member.bio}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <FloorGallery label="On the floor" />

      {/* Shop preview */}
      <section className="border-t border-line bg-bg-elevated py-24">
        <div className="container-page">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <Reveal>
              <p className="section-label">Shop the look</p>
              <h2 className="mt-3 font-display text-4xl tracking-wide md:text-5xl">
                Exclusive branded gear
              </h2>
              <p className="mt-3 max-w-lg text-muted">
                Midnight tees, cosy hoodies and totes for the modern line dancer.
              </p>
            </Reveal>
            <Reveal>
              <Link href="/shop/" className="btn-secondary">
                Visit shop
                <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <Link
                  href="/shop/"
                  className="card-surface group block overflow-hidden transition hover:-translate-y-1 hover:border-accent/30"
                >
                  <div className="relative aspect-square bg-surface">
                    <Image
                      src={p.image}
                      alt={p.name}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-xl tracking-wide">{p.name}</h3>
                      <span className="shrink-0 font-bold text-accent">£{p.price.toFixed(2)}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted">{p.description}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <FranchiseTeaser />

      <CtaBand />
    </>
  );
}
