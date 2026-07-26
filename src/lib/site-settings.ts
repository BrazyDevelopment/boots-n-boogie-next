import { listRecords, createRecord, updateRecord, type CmsContentData } from "./sitedata";
import { parseJsonSafe } from "./cms-types";

export type SiteVisibilitySettings = {
  /** When false, /franchise is hidden from nav/footer and blocked publicly */
  franchisePagePublic: boolean;
};

export const DEFAULT_SITE_VISIBILITY: SiteVisibilitySettings = {
  franchisePagePublic: true,
};

const VISIBILITY_SLUG = "site_visibility";

export async function loadSiteVisibility(): Promise<SiteVisibilitySettings> {
  try {
    const rows = await listRecords<CmsContentData>("cms_content", 100);
    const row = rows.find(
      (r) => r.data.content_type === "settings" && r.data.slug === VISIBILITY_SLUG
    );
    if (!row) return { ...DEFAULT_SITE_VISIBILITY };
    return {
      ...DEFAULT_SITE_VISIBILITY,
      ...parseJsonSafe<Partial<SiteVisibilitySettings>>(row.data.body_json, {}),
    };
  } catch {
    return { ...DEFAULT_SITE_VISIBILITY };
  }
}

export async function saveSiteVisibility(settings: SiteVisibilitySettings): Promise<void> {
  const rows = await listRecords<CmsContentData>("cms_content", 100);
  const existing = rows.find(
    (r) => r.data.content_type === "settings" && r.data.slug === VISIBILITY_SLUG
  );
  const data = {
    content_type: "settings" as const,
    slug: VISIBILITY_SLUG,
    title: "Site visibility",
    summary: "Public page visibility flags",
    body_json: JSON.stringify(settings),
    image_url: "",
    published: true,
    sort_order: 0,
    record_status: "active",
  };
  if (existing) {
    await updateRecord("cms_content", existing.id, data as unknown as CmsContentData);
  } else {
    await createRecord("cms_content", data as unknown as CmsContentData);
  }
}
