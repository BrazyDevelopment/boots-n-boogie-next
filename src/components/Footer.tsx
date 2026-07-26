"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Share2 } from "lucide-react";
import { NAV, SITE } from "@/lib/data";
import { loadSiteVisibility } from "@/lib/site-settings";

export function Footer() {
  const pathname = usePathname();
  const [franchisePublic, setFranchisePublic] = useState(true);
  // Community PWA shell — hide chrome, but hooks must still run every render
  const hideChrome = Boolean(pathname?.startsWith("/community"));

  useEffect(() => {
    if (hideChrome) return;
    loadSiteVisibility()
      .then((s) => setFranchisePublic(s.franchisePagePublic))
      .catch(() => setFranchisePublic(true));
  }, [hideChrome]);

  const links = useMemo(
    () =>
      NAV.filter((item) => {
        if (item.href === "/franchise/" && !franchisePublic) return false;
        return true;
      }),
    [franchisePublic]
  );

  if (hideChrome) {
    return null;
  }

  return (
    <footer className="mt-8 border-t border-line bg-bg-elevated">
      <div className="container-page py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block">
              <Image
                src="/images/logo.png"
                alt={SITE.name}
                width={140}
                height={140}
                className="h-16 w-16 object-contain md:h-20 md:w-20"
              />
            </Link>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted">
              Family-run line dancing in Rugby and across the Midlands. Classes, socials and
              community from ultra beginner to improver — no partner needed, just bring a smile.
            </p>
            <a
              href={SITE.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cream hover:text-accent"
            >
              <Share2 size={18} />
              Follow us on Facebook
            </a>
          </div>

          <div>
            <h4 className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-accent">
              Explore
            </h4>
            <ul className="space-y-2 text-sm text-muted">
              {links.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-accent">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-accent">
              Visit us
            </h4>
            <ul className="space-y-2 text-sm text-muted">
              <li className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  {SITE.venue}
                  <br />
                  {SITE.address.join(", ")}
                </span>
              </li>
              <li>
                <a
                  href={SITE.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-cream hover:text-accent"
                >
                  Open in Google Maps →
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8 text-sm text-muted">
          <span>
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </span>
          <a href={`mailto:${SITE.email}`} className="hover:text-accent">
            {SITE.email}
          </a>
        </div>
      </div>
    </footer>
  );
}
