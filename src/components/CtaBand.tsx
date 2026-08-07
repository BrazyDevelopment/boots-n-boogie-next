import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
import { Reveal } from "./Reveal";
import { BootIcon, CowboyHatIcon, HorseshoeIcon, WesternDivider } from "./WesternDecor";

export function CtaBand({
  title = "Ready to kick up your heels?",
  body = "Book your first class online — no partner needed. Drop-in £10, or join for £40/month: one free class a week, free quarterly socials and a free +1.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="py-20">
      <div className="container-page">
        <Reveal>
          <div className="relative overflow-hidden rounded-[1.75rem] border border-accent/30 bg-gradient-to-br from-copper/30 via-bg-card to-bg-elevated px-8 py-12 md:px-14 md:py-16">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-copper/25 blur-3xl" />
            <div className="grain opacity-40" />
            <CowboyHatIcon
              size={140}
              className="pointer-events-none absolute -right-4 top-4 text-accent/10 md:right-8 md:top-8"
            />
            <BootIcon
              size={100}
              className="pointer-events-none absolute bottom-4 left-4 text-copper/15 md:left-10"
            />
            <HorseshoeIcon
              size={70}
              className="pointer-events-none absolute right-1/3 bottom-6 rotate-[-20deg] text-accent/10"
            />
            <div className="relative max-w-2xl">
              <p className="section-label">Join the floor</p>
              <h2 className="western-heading-glow mt-3 font-display text-3xl font-extrabold tracking-tight md:text-5xl">
                {title}
              </h2>
              <WesternDivider className="mt-4 max-w-[12rem]" />
              <p className="mt-4 text-muted">{body}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/book/" className="btn-primary">
                  <Ticket size={18} />
                  Book a class
                </Link>
                <Link href="/subscribe/" className="btn-secondary">
                  Social membership
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
