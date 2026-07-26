"use client";

import { useState } from "react";
import { fileToDataUrl } from "@/lib/images";

export function ImageUploadField({
  label = "Image",
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const url = await fileToDataUrl(file);
      onChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      {value ? (
        <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-line text-xs text-muted">
          No image
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={(e) => onFile(e.target.files?.[0] || null)}
        className="block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-bg"
      />
      <input
        type="text"
        value={value.startsWith("data:") ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste image URL / path"
        className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
      />
      {busy && <p className="text-xs text-muted">Compressing image…</p>}
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
