/** Subtle Western motifs — pure SVG, no external assets */

export function HorseshoeIcon({ className = "", size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M16 10c-6 8-8 18-6 28 1 6 5 12 12 14 2 .6 4-1 4-3v-8c0-1.5-1-2.5-2.5-2.5h-3c-2.5 0-4.5-2.5-4-5 1.2-6 3.5-11 7.5-15 1.2-1.2.5-3.5-1.2-3.5H16z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M48 10c6 8 8 18 6 28-1 6-5 12-12 14-2 .6-4-1-4-3v-8c0-1.5 1-2.5 2.5-2.5h3c2.5 0 4.5-2.5 4-5-1.2-6-3.5-11-7.5-15-1.2-1.2-.5-3.5 1.2-3.5H48z"
        fill="currentColor"
        opacity="0.95"
      />
      <circle cx="18" cy="44" r="1.6" fill="currentColor" opacity="0.5" />
      <circle cx="22" cy="50" r="1.6" fill="currentColor" opacity="0.5" />
      <circle cx="46" cy="44" r="1.6" fill="currentColor" opacity="0.5" />
      <circle cx="42" cy="50" r="1.6" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function CowboyHatIcon({ className = "", size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden
    >
      <ellipse cx="32" cy="42" rx="26" ry="7" fill="currentColor" opacity="0.9" />
      <path
        d="M14 40c2-14 8-22 18-22s16 8 18 22H14z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M22 22c2-6 6-10 10-10s8 4 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />
      <rect x="20" y="34" width="24" height="5" rx="2" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function BootIcon({ className = "", size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M22 8h14v22c0 2 1 4 3 5l12 6c3 1.5 5 4.5 5 8v5H18v-8c0-4 1-8 3-11l1-2V8z"
        fill="currentColor"
        opacity="0.95"
      />
      <path d="M18 48h38v6H16c0-2 1-4 2-6z" fill="currentColor" opacity="0.7" />
      <path d="M26 14h6M26 20h6M26 26h6" stroke="#1a1208" strokeWidth="1.5" opacity="0.25" />
    </svg>
  );
}

export function StarSpurIcon({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2l1.8 5.5H20l-4.5 3.3 1.7 5.4L12 13.8 6.8 16.2l1.7-5.4L4 7.5h6.2L12 2z" />
    </svg>
  );
}

/** Corner ornaments for heroes / sections */
export function WesternCorners({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <HorseshoeIcon
        size={120}
        className="absolute -left-4 top-16 text-accent/10 md:left-2 md:top-24"
      />
      <CowboyHatIcon
        size={100}
        className="absolute -right-2 top-20 text-copper/15 md:right-6 md:top-28"
      />
      <BootIcon
        size={90}
        className="absolute bottom-8 left-[8%] text-accent/10 md:bottom-12"
      />
      <HorseshoeIcon
        size={80}
        className="absolute bottom-16 right-[12%] rotate-12 text-copper/12"
      />
    </div>
  );
}

/** Thin western divider with horseshoe */
export function WesternDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <HorseshoeIcon size={22} className="shrink-0 text-accent/70" />
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
    </div>
  );
}
