"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  GraduationCap,
  MapPinned,
  PoundSterling,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { FRANCHISE, SITE } from "@/lib/data";
import { createRecord } from "@/lib/sitedata";
import { loadSiteVisibility } from "@/lib/site-settings";

type FranchiseEnquiry = {
  full_name: string;
  email: string;
  phone: string;
  town_city: string;
  region: string;
  experience: string;
  message: string;
  record_status: string;
};

export default function FranchisePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [gateReady, setGateReady] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    loadSiteVisibility()
      .then((s) => {
        if (cancelled) return;
        const isAdmin = user?.role === "admin";
        if (!s.franchisePagePublic && !isAdmin) {
          setAllowed(false);
          router.replace("/");
          return;
        }
        setAllowed(true);
        setGateReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setAllowed(true);
          setGateReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const payload: FranchiseEnquiry = {
      full_name: String(fd.get("full_name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      town_city: String(fd.get("town_city") || "").trim(),
      region: String(fd.get("region") || "").trim(),
      experience: String(fd.get("experience") || "").trim(),
      message: String(fd.get("message") || "").trim(),
      record_status: "new",
    };
    try {
      await createRecord<FranchiseEnquiry>("franchise_enquiries", payload);
      setDone(true);
    } catch (err) {
      // Fallback: open mail client if Site Data unavailable
      const subject = encodeURIComponent(`Franchise enquiry — ${payload.town_city}`);
      const body = encodeURIComponent(
        `Name: ${payload.full_name}\nEmail: ${payload.email}\nPhone: ${payload.phone}\nTown/City: ${payload.town_city}\nRegion: ${payload.region}\nExperience: ${payload.experience}\n\n${payload.message}`
      );
      window.location.href = `mailto:${SITE.email}?subject=${subject}&body=${body}`;
      setError(
        err instanceof Error
          ? `${err.message} — opened email draft as backup.`
          : "Opened email draft as backup."
      );
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (!gateReady || !allowed) {
    return (
      <section className="container-page py-36">
        <p className="text-muted">Loading…</p>
      </section>
    );
  }

  return (
    <>
      <section className="relative overflow-hidden border-b border-line pt-28 pb-14 md:pt-36">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_10%_0%,rgba(232,160,23,0.16),transparent_55%),radial-gradient(ellipse_60%_40%_at_90%_20%,rgba(196,92,38,0.14),transparent_50%)]" />
        <div className="container-page">
          {user?.role === "admin" && (
            <p className="mb-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
              Admin preview — this page may be hidden from the public site. Toggle visibility in
              Admin → Franchise.
            </p>
          )}
          <p className="section-label">Franchise opportunities</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl tracking-wide md:text-6xl">
            {FRANCHISE.tagline}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Take Boots N Boogie to another UK city or town. The pack includes full curriculum,
            branding, merch, a speaker system with training, a free 4-night Airbnb stay in Rugby,
            and HQ social-media marketing to fill your classes — plus an upfront fee and fair revenue
            share.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#enquire" className="btn-primary">
              Enquire now
            </a>
            <Link href="/about/" className="btn-secondary">
              Our story
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container-page grid gap-5 md:grid-cols-3">
          {[
            {
              icon: PoundSterling,
              title: `£${FRANCHISE.upfrontFeeGbp.toLocaleString("en-GB")} launch fee`,
              body: "One-off. Territory licence, full curriculum, brand kit and instructor training included.",
            },
            {
              icon: Building2,
              title: `${FRANCHISE.royaltyPercent}% + ${FRANCHISE.brandFundPercent}% ongoing`,
              body: `10% dance royalty + 2% brand fund + ${FRANCHISE.merchRoyaltyPercent}% merch share (merch is never royalty-free).`,
            },
            {
              icon: MapPinned,
              title: `${FRANCHISE.exclusiveRadiusMiles}-mile exclusivity`,
              body: "Protected territory so you can grow your local community without franchisee overlap.",
            },
          ].map((card) => (
            <div key={card.title} className="card-surface p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <card.icon size={20} />
              </div>
              <h2 className="mt-4 font-display text-2xl tracking-wide">{card.title}</h2>
              <p className="mt-2 text-sm text-muted">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-bg-elevated py-16">
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-accent">
              <GraduationCap size={22} />
              <p className="section-label !mb-0">What you receive</p>
            </div>
            <h2 className="mt-3 font-display text-3xl tracking-wide md:text-4xl">
              Complete curriculum & launch system
            </h2>
            <ul className="mt-6 space-y-3">
              {FRANCHISE.includes.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-muted">
                  <Check className="mt-0.5 shrink-0 text-accent" size={18} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="section-label">Investment overview</p>
            <h2 className="mt-3 font-display text-3xl tracking-wide md:text-4xl">
              Built for profitability
            </h2>
            <ul className="mt-6 space-y-3">
              {FRANCHISE.investmentNotes.map((item) => (
                <li key={item} className="card-surface p-4 text-sm text-muted">
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-cream/90">{FRANCHISE.whyFigures}</p>
            <div className="card-surface mt-6 p-5 text-sm text-muted">
              <p className="font-semibold text-cream">Illustrative unit economics</p>
              <p className="mt-2">
                Example: 35 members @ £40 + 40 drop-ins @ £10 ≈ £1,800/month dance revenue before
                venue costs. HQ share (12% total) ≈ £216; franchisee keeps the rest of gross for
                venue, instructor time and profit. One-off £9,950 licence is typically recovered
                within the first year of a busy site.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="enquire" className="py-16">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="section-label">Next step</p>
            <h2 className="mt-3 font-display text-3xl tracking-wide md:text-4xl">
              Franchise enquiry
            </h2>
            <p className="mt-4 text-muted">
              Tell us where you want to open and a little about your background. We review territory
              availability and follow up with an info pack and discovery call.
            </p>
            <p className="mt-4 text-sm text-muted">
              Prefer email?{" "}
              <a href={`mailto:${SITE.email}?subject=Franchise%20enquiry`} className="font-semibold text-accent">
                {SITE.email}
              </a>
            </p>
          </div>

          <div className="card-surface p-7 md:p-9">
            {done ? (
              <div>
                <h3 className="font-display text-3xl tracking-wide text-accent">Thanks for getting in touch</h3>
                <p className="mt-3 text-muted">
                  We&apos;ve received your franchise enquiry and will be in touch about your area.
                </p>
                {error && <p className="mt-3 text-xs text-muted">{error}</p>}
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    Full name
                    <input
                      name="full_name"
                      required
                      className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Email
                    <input
                      name="email"
                      type="email"
                      required
                      className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    Phone
                    <input
                      name="phone"
                      className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Target town / city
                    <input
                      name="town_city"
                      required
                      placeholder="e.g. Leicester"
                      className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  </label>
                </div>
                <label className="block text-sm font-semibold">
                  Region / county
                  <input
                    name="region"
                    placeholder="e.g. East Midlands"
                    className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Dance / business experience
                  <textarea
                    name="experience"
                    rows={3}
                    placeholder="Teaching, hospitality, events, or first-time operator…"
                    className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Tell us about your plans
                  <textarea
                    name="message"
                    required
                    rows={4}
                    className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </label>
                {error && !done && <p className="text-sm text-red-400">{error}</p>}
                <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50">
                  {busy ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> Sending…
                    </>
                  ) : (
                    "Submit franchise enquiry"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
