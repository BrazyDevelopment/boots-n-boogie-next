"use client";

import { useEffect } from "react";

/**
 * After a deploy, mobile clients can hold stale Next.js chunk URLs.
 * Soft-navigation then fails until a hard reload. Recover once automatically.
 */
export function ChunkErrorRecovery() {
  useEffect(() => {
    const key = "bnb-chunk-reload";

    function isChunkError(err: unknown): boolean {
      if (!err) return false;
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : String((err as { message?: string })?.message || err);
      return /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
        msg
      );
    }

    function recover() {
      try {
        if (sessionStorage.getItem(key) === "1") return;
        sessionStorage.setItem(key, "1");
      } catch {
        /* private mode */
      }
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      if (isChunkError(event.error) || isChunkError(event.message)) {
        recover();
      }
    }

    function onRejection(event: PromiseRejectionEvent) {
      if (isChunkError(event.reason)) {
        recover();
      }
    }

    // Clear one-shot flag after a successful settle
    try {
      if (sessionStorage.getItem(key) === "1") {
        const t = window.setTimeout(() => {
          try {
            sessionStorage.removeItem(key);
          } catch {
            /* ignore */
          }
        }, 4000);
        return () => {
          window.clearTimeout(t);
          window.removeEventListener("error", onError);
          window.removeEventListener("unhandledrejection", onRejection);
        };
      }
    } catch {
      /* ignore */
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
