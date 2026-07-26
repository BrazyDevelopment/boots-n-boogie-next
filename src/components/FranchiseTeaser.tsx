"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { loadSiteVisibility } from "@/lib/site-settings";

export function FranchiseTeaser() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    loadSiteVisibility()
      .then((s) => setVisible(s.franchisePagePublic))
      .catch(() => setVisible(true));
  }, []);

  if (!visible) return null;

  return (
    <section className="border-t border-line py-20">
      <div className="container-page">
        <Reveal>
          <div className="card-surface relative overflow-hidden px-8 py-12 md:px-12">
            <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
            <p className="section-label">Grow with us</p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-wide md:text-5xl">
              Franchise Boots N Boogie in your town
            </h2>
            <p className="mt-4 max-w-2xl text-muted">
              Full curriculum, brand and training from £9,950. 10% royalty + 2% brand fund. Exclusive
              UK territories — enquire about becoming a franchisee.
            </p>
            <Link href="/franchise/" className="btn-primary mt-8">
              Franchise opportunities
              <ArrowRight size={18} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
