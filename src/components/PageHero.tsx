import { ReactNode } from "react";
import { Reveal } from "./Reveal";

export function PageHero({
  label,
  title,
  description,
  children,
}: {
  label?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line pt-28 pb-16 md:pt-36 md:pb-20">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,rgba(232,160,23,0.14),transparent_55%),radial-gradient(ellipse_60%_50%_at_90%_20%,rgba(196,92,38,0.12),transparent_50%)]" />
      <div className="grain" />
      <div className="container-page relative">
        <Reveal>
          {label && <p className="section-label">{label}</p>}
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl">
            {title}
          </h1>
          {description && (
            <p className="mt-5 max-w-2xl text-lg text-muted">{description}</p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </Reveal>
      </div>
    </section>
  );
}
