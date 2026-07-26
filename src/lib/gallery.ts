import { GALLERY } from "@/lib/data";
import type { CmsContentData } from "@/lib/cms-types";
import { listRecords, type SiteRecord } from "@/lib/sitedata";

export type GalleryItem = {
  id: string;
  src: string;
  alt: string;
  sort_order: number;
};

/** Defaults used when no CMS gallery images are published yet */
export function defaultGalleryItems(): GalleryItem[] {
  return GALLERY.map((src, i) => ({
    id: `default-${i}`,
    src,
    alt: `Boots N Boogie moment ${i + 1}`,
    sort_order: i,
  }));
}

export async function loadGalleryItems(): Promise<GalleryItem[]> {
  try {
    const rows = await listRecords<CmsContentData>("cms_content", 200);
    const items = rows
      .filter(
        (r) =>
          r.data.content_type === "gallery" &&
          r.data.published &&
          r.data.record_status !== "archived" &&
          (r.data.image_url || "").trim()
      )
      .map((r) => ({
        id: r.id,
        src: r.data.image_url,
        alt: r.data.title || r.data.summary || "Boots N Boogie on the floor",
        sort_order: r.data.sort_order ?? 0,
      }))
      .sort((a, b) => a.sort_order - b.sort_order || a.alt.localeCompare(b.alt));
    if (items.length) return items;
  } catch {
    /* fall through */
  }
  return defaultGalleryItems();
}

export function galleryRecordsFromCms(
  cms: SiteRecord<CmsContentData>[]
): SiteRecord<CmsContentData>[] {
  return cms
    .filter((c) => c.data.content_type === "gallery")
    .sort((a, b) => a.data.sort_order - b.data.sort_order);
}
