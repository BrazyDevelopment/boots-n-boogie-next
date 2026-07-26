"use client";

import { FormEvent, useState } from "react";
import { MapPin, Mail, MessageCircle, Share2 } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { Reveal } from "@/components/Reveal";
import { SITE } from "@/lib/data";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const message = String(data.get("message") || "").trim();
    const subject = encodeURIComponent(`Boots N Boogie enquiry from ${name || "website"}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}\n\n— Sent from the Boots N Boogie redesign site`
    );
    window.location.href = `mailto:${SITE.email}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <>
      <PageHero
        label="Contact"
        title="Say hello"
        description="Questions about classes, socials, or private group bookings? We'd love to hear from you."
      />

      <section className="py-20">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <div className="space-y-5">
              <div className="card-surface p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <MapPin size={20} />
                </div>
                <h3 className="mt-4 font-display text-2xl tracking-wide">Find us</h3>
                <p className="mt-2 text-sm text-muted">
                  {SITE.venue}
                  <br />
                  {SITE.address.join(", ")}
                </p>
                <a
                  href={SITE.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-sm font-bold text-accent hover:text-accent-hover"
                >
                  Open in Google Maps →
                </a>
              </div>

              <div className="card-surface p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Share2 size={20} />
                </div>
                <h3 className="mt-4 font-display text-2xl tracking-wide">Facebook</h3>
                <p className="mt-2 text-sm text-muted">
                  Class updates, social photos and last-minute tickets land on our page first.
                </p>
                <a
                  href={SITE.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-sm font-bold text-accent hover:text-accent-hover"
                >
                  Visit Facebook →
                </a>
              </div>

              <div className="card-surface p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Mail size={20} />
                </div>
                <h3 className="mt-4 font-display text-2xl tracking-wide">Email</h3>
                <a
                  href={`mailto:${SITE.email}`}
                  className="mt-2 block text-sm font-semibold text-cream hover:text-accent"
                >
                  {SITE.email}
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <form onSubmit={onSubmit} className="card-surface p-7 md:p-9">
              <div className="flex items-center gap-3">
                <MessageCircle className="text-accent" size={22} />
                <h2 className="font-display text-3xl tracking-wide">Send a message</h2>
              </div>
              <p className="mt-2 text-sm text-muted">
                Opens your email app with the message ready to send.
              </p>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Name
                  <input
                    name="name"
                    required
                    className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal text-foreground outline-none ring-accent/40 focus:ring-2"
                    placeholder="Your name"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal text-foreground outline-none ring-accent/40 focus:ring-2"
                    placeholder="you@example.com"
                  />
                </label>
              </div>
              <label className="mt-5 block text-sm font-semibold">
                Message
                <textarea
                  name="message"
                  required
                  rows={6}
                  className="mt-2 w-full resize-y rounded-xl border border-line bg-bg px-4 py-3 font-normal text-foreground outline-none ring-accent/40 focus:ring-2"
                  placeholder="Tell us about classes, events, or a private group..."
                />
              </label>
              <button type="submit" className="btn-primary mt-6 w-full sm:w-auto">
                Open email draft
              </button>
              {sent && (
                <p className="mt-4 text-sm text-accent">
                  Email draft opened — hit send when you&apos;re ready.
                </p>
              )}
            </form>
          </Reveal>
        </div>
      </section>
    </>
  );
}
