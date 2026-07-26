export type CmsContentType =
  | "blog"
  | "event"
  | "class"
  | "venue"
  | "session"
  | "session_cancel"
  | "settings"
  /** Company-run studio in another town (not a franchise) */
  | "hq_location"
  /** Passwordless magic-link sign-in tokens */
  | "auth_token"
  /** Homepage / about "On the floor" gallery images */
  | "gallery"
  /** Subscriber community chat channel */
  | "chat_channel";

export type CmsContentData = {
  content_type: CmsContentType;
  slug: string;
  title: string;
  summary: string;
  body_json: string;
  image_url: string;
  published: boolean;
  sort_order: number;
  record_status: string;
};

export type ProductData = {
  sku: string;
  name: string;
  description: string;
  price_gbp: number;
  image_url: string;
  category: string;
  sizes_json: string;
  stock_json: string;
  active: boolean;
  record_status: string;
};

export type FranchiseeData = {
  full_name: string;
  email: string;
  phone: string;
  town_city: string;
  region: string;
  territory: string;
  started_at: string;
  upfront_fee_gbp: number;
  royalty_percent: number;
  record_status: string;
  notes: string;
  /** JSON array of class slots for this territory */
  schedule_json?: string;
};

export type FranchiseClassSlot = {
  classId: string;
  title: string;
  level: string;
  dayOfWeek: number;
  time: string;
  endTime: string;
  duration?: string;
  venueName: string;
  venueAddress: string;
  price: number;
  image?: string;
};

export type FranchiseEnquiryData = {
  full_name: string;
  email: string;
  phone: string;
  town_city: string;
  region: string;
  experience: string;
  message: string;
  record_status: string;
};

export type BlogBody = {
  date?: string;
  readMins?: number;
  sections: { title: string; body: string }[];
};

export type EventBody = {
  dateLabel: string;
  dateISO: string;
  endDateISO?: string;
  time: string;
  doors?: string;
  venue: string;
  address: string;
  eventStatus: "open" | "closed";
  isSocial: boolean;
  level: string;
  details: string[];
  tickets: { id: string; name: string; price: number }[];
};

export type ClassBody = {
  classKey: string;
  badge?: string | null;
  duration: string;
  price: number;
  level: string;
  dayOfWeek: number;
  time: string;
  endTime: string;
  description: string;
  highlights: string[];
  venueId?: string;
};

export type VenueBody = {
  venueKey: string;
  address: string;
  mapsUrl?: string;
  notes?: string;
};

export type SessionBody = {
  classKey: string;
  classTitle: string;
  date: string;
  time: string;
  endTime?: string;
  price: number;
  venueName?: string;
  capacity?: number;
  notes?: string;
};

/** HQ satellite town (company-owned expansion, not franchise) */
export type HqLocationBody = {
  region?: string;
  blurb?: string;
  schedule: FranchiseClassSlot[];
};

export function parseJsonSafe<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function emptyClassSlot(partial?: Partial<FranchiseClassSlot>): FranchiseClassSlot {
  return {
    classId: partial?.classId || "ultra-beginner",
    title: partial?.title || "Beginner Line Dance",
    level: partial?.level || "Beginner",
    dayOfWeek: partial?.dayOfWeek ?? 1,
    time: partial?.time || "19:00",
    endTime: partial?.endTime || "20:30",
    duration: partial?.duration || "1 hr 30 min",
    venueName: partial?.venueName || "",
    venueAddress: partial?.venueAddress || "",
    price: partial?.price ?? 10,
    image: partial?.image || "/images/class-beginner.jpg",
  };
}
