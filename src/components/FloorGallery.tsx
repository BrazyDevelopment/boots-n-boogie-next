"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import {
  defaultGalleryItems,
  loadGalleryItems,
  type GalleryItem,
} from "@/lib/gallery";

function isLocalPath(src: string) {
  return src.startsWith("/") && !src.startsWith("//");
}

export function FloorGallery({
  label = "On the floor",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const [items, setItems] = useState<GalleryItem[]>(() => defaultGalleryItems());
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    loadGalleryItems()
      .then(setItems)
      .catch(() => undefined);
  }, []);

  const close = useCallback(() => setOpenIndex(null), []);
  const prev = useCallback(() => {
    setOpenIndex((i) => (i == null ? i : (i - 1 + items.length) % items.length));
  }, [items.length]);
  const next = useCallback(() => {
    setOpenIndex((i) => (i == null ? i : (i + 1) % items.length));
  }, [items.length]);

  useEffect(() => {
    if (openIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, close, prev, next]);

  const active = openIndex != null ? items[openIndex] : null;

  return (
    <>
      <section className={`py-16 ${className}`}>
        <div className="container-wide">
          <Reveal>
            <p className="section-label mb-6 text-center">{label}</p>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((item, i) => (
              <Reveal key={item.id} delay={i * 0.04}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`View larger: ${item.alt}`}
                >
                  {isLocalPath(item.src) ? (
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.src}
                      alt={item.alt}
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  )}
                  <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/25" />
                  <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cream opacity-0 transition group-hover:opacity-100">
                    Expand
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {active && openIndex != null && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
          onClick={close}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/50 p-2 text-cream hover:bg-white/10"
            onClick={close}
            aria-label="Close"
          >
            <X size={22} />
          </button>
          {items.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-3 text-cream hover:bg-white/10 md:left-6"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/50 p-3 text-cream hover:bg-white/10 md:right-6"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          <div
            className="relative max-h-[90vh] max-w-[min(96vw,1100px)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.src}
              alt={active.alt}
              className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
            <p className="mt-3 text-center text-sm text-cream/80">
              {active.alt}
              <span className="text-muted">
                {" "}
                · {openIndex + 1} / {items.length}
              </span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
