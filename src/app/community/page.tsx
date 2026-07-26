"use client";

import Link from "next/link";
import Image from "next/image";
import { CommunityChat } from "@/components/CommunityChat";
import { SITE } from "@/lib/data";

export default function CommunityPage() {
  return (
    <>
      <header className="mb-3 flex shrink-0 items-center justify-between gap-3 border-b border-line pb-3">
        <Link href="/community/" className="flex items-center gap-2">
          <Image
            src="/images/logo.png"
            alt={SITE.name}
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
          <div>
            <p className="font-display text-lg leading-none tracking-wide text-cream">
              Community
            </p>
            <p className="text-[11px] text-muted">{SITE.name}</p>
          </div>
        </Link>
        <Link
          href="/account/"
          className="text-xs font-bold uppercase tracking-wide text-accent hover:underline"
        >
          Studio
        </Link>
      </header>
      <div className="min-h-0 flex-1">
        <CommunityChat standalone />
      </div>
      <p className="mt-2 shrink-0 text-center text-[10px] text-muted">
        Tip: on your phone, open Share → <strong className="text-cream">Add to Home Screen</strong>{" "}
        for a chat app icon.
      </p>
    </>
  );
}
