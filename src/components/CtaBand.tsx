import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
import { Reveal } from "./Reveal";

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
          <div className="relative overflow-hidden rounded-[1.75rem] border border-accent/25 bg-gradient-to-br from-copper/25 via-bg-card to-bg-elevated px-8 py-12 md:px-14 md:py-16">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-copper/20 blur-3xl" />
            <div className="relative max-w-2xl">
              <p className="section-label">Join the floor</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-5xl">
                {title}
              </h2>
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
