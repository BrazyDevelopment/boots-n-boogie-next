"use client";

/** Circular profile avatar with initials fallback */

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

export function UserAvatar({
  name,
  src,
  size = 40,
  className = "",
  ring = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const label = initials(name);
  const fontSize = Math.max(10, Math.round(size * 0.34));

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${ring ? "ring-2 ring-accent/40" : ""} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/90 to-copper font-bold text-bg ${
        ring ? "ring-2 ring-accent/40" : ""
      } ${className}`}
      style={{ width: size, height: size, fontSize }}
      aria-label={name}
      title={name}
    >
      {label}
    </div>
  );
}
