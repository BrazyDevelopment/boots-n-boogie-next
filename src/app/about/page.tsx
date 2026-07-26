import type { Metadata } from "next";
import Image from "next/image";
import { CtaBand } from "@/components/CtaBand";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { FloorGallery } from "@/components/FloorGallery";
import { MISSION_QUOTE, SITE, TEAM } from "@/lib/data";

export const metadata: Metadata = {
  title: "About",
  description:
    "Meet Jade, Gemma and the Boots N Boogie family — line dancing classes built on community in Rugby.",
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        label="About us"
        title="A family of dancers, building a community"
        description="Boots N Boogie is a unique space for friendship, fun and line dancing — without the pressure of perfection."
      />

      <section className="py-20">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] border border-line">
              <Image
                src="/images/team-jade.jpg"
                alt="Jade, Boots N Boogie instructor"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="section-label">Our mission</p>
            <h2 className="mt-3 font-display text-4xl tracking-wide md:text-5xl">
              Fun over perfection
            </h2>
            <blockquote className="mt-8 border-l-4 border-accent pl-6 text-lg leading-relaxed text-cream/90">
              “{MISSION_QUOTE}”
            </blockquote>
            <p className="mt-6 text-muted">
              Based at {SITE.venue} on {SITE.addressShort.split(",")[1]?.trim() || "Elsee Road"}, we
              welcome dancers of all ages — ultra beginner through improver — and host socials that
              feel like a proper night out with your dance family.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-line bg-bg-elevated py-20">
        <div className="container-page">
          <Reveal>
            <p className="section-label">Meet the team</p>
            <h2 className="mt-3 font-display text-4xl tracking-wide md:text-5xl">
              The faces behind the floor
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {TEAM.map((member, i) => (
              <Reveal key={member.name} delay={i * 0.1}>
                <article className="card-surface overflow-hidden md:flex">
                  <div className="relative aspect-[4/5] md:w-2/5 md:shrink-0">
                    <Image
                      src={member.image}
                      alt={member.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 280px"
                    />
                  </div>
                  <div className="flex flex-col justify-center p-7 md:w-3/5">
                    <h3 className="font-display text-3xl tracking-wide">{member.name}</h3>
                    <p className="mt-1 text-sm font-bold uppercase tracking-wider text-accent">
                      {member.role}
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-muted">{member.bio}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <FloorGallery label="Moments from the floor" />

      <CtaBand />
    </>
  );
}
