"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  BLOG_POSTS,
  CLASSES,
  EVENTS,
  FRANCHISE,
  GALLERY,
  PRODUCTS,
  SITE,
  SUBSCRIPTION_PLAN,
  VENUES,
} from "@/lib/data";
import { BLACKOUT_NOTE } from "@/lib/blackouts";
import { ImageUploadField } from "@/components/ImageUploadField";
import {
  Field,
  Modal,
  ToastStack,
  inputCls,
  useConfirmDialog,
  useToasts,
} from "@/components/admin/AdminChrome";
import { ScheduleSlotsEditor } from "@/components/admin/ScheduleSlotsEditor";
import { MailingAdmin } from "@/components/admin/MailingAdmin";
import {
  DEFAULT_PAYMENT_SETTINGS,
  loadPaymentSettings,
  savePaymentSettings,
  sendResendEmail,
  type PaymentSettings,
} from "@/lib/payments";
import { upcomingSessions } from "@/lib/schedule";
import {
  parseJsonSafe,
  type ClassBody,
  type CmsContentData,
  type CmsContentType,
  type EventBody,
  type FranchiseeData,
  type FranchiseEnquiryData,
  type ProductData,
  type SessionBody,
  type VenueBody,
  type BlogBody,
  type FranchiseClassSlot,
  type HqLocationBody,
  emptyClassSlot,
} from "@/lib/cms-types";
import {
  createRecord,
  deleteRecord,
  listRecords,
  updateRecord,
  type BookingData,
  type MemberData,
  type ShopOrderData,
  type SocialRegData,
  type SubscriptionData,
  type SiteRecord,
} from "@/lib/sitedata";
import {
  DEFAULT_SITE_VISIBILITY,
  loadSiteVisibility,
  saveSiteVisibility,
  type SiteVisibilitySettings,
} from "@/lib/site-settings";
import { formatDateUK } from "@/lib/dates";
import { convertFreeBookingsAfterBenefits } from "@/lib/membership";

type Tab =
  | "overview"
  | "members"
  | "subs"
  | "bookings"
  | "schedule"
  | "venues"
  | "classes"
  | "events"
  | "blogs"
  | "shop"
  | "orders"
  | "hq_towns"
  | "gallery"
  | "chat"
  | "franchise"
  | "payments"
  | "mailing"
  | "attendance"
  | "revenue"
  | "cancel_session";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Accounts" },
  { id: "subs", label: "Subscriptions" },
  { id: "bookings", label: "Bookings" },
  { id: "attendance", label: "Attendance" },
  { id: "revenue", label: "Revenue" },
  { id: "cancel_session", label: "Cancel session" },
  { id: "schedule", label: "Class dates" },
  { id: "classes", label: "Classes" },
  { id: "venues", label: "Venues" },
  { id: "hq_towns", label: "HQ towns" },
  { id: "gallery", label: "On the floor" },
  { id: "chat", label: "Community chat" },
  { id: "events", label: "Events" },
  { id: "blogs", label: "Blog" },
  { id: "shop", label: "Shop" },
  { id: "orders", label: "Orders" },
  { id: "franchise", label: "Franchise" },
  { id: "mailing", label: "Mailing list" },
  { id: "payments", label: "Payments / email" },
];

type VenueOption = { name: string; address: string };

function buildVenueOptions(cms: SiteRecord<CmsContentData>[]): VenueOption[] {
  const map = new Map<string, VenueOption>();
  for (const v of Object.values(VENUES)) {
    map.set(v.name, { name: v.name, address: v.address });
  }
  for (const c of cms) {
    if (c.data.content_type !== "venue") continue;
    if (c.data.record_status === "archived") continue;
    const body = parseJsonSafe<VenueBody>(c.data.body_json, {
      venueKey: c.data.slug,
      address: c.data.summary || "",
    });
    const name = c.data.title || body.venueKey || c.data.slug;
    if (!name) continue;
    map.set(name, {
      name,
      address: body.address || c.data.summary || "",
    });
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function VenueSelect({
  value,
  options,
  onChange,
  onPick,
}: {
  value: string;
  options: VenueOption[];
  onChange: (name: string) => void;
  /** Called when a known venue is chosen (for auto-filling address etc.) */
  onPick?: (venue: VenueOption) => void;
}) {
  const names = options.map((o) => o.name);
  const isKnown = names.includes(value);
  const selectValue = isKnown ? value : value ? "__other__" : options[0]?.name || "";

  return (
    <div className="space-y-2">
      <select
        className={inputCls}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__other__") {
            onChange(value && !isKnown ? value : "");
            return;
          }
          onChange(v);
          const opt = options.find((o) => o.name === v);
          if (opt) onPick?.(opt);
        }}
      >
        {options.map((o) => (
          <option key={o.name} value={o.name}>
            {o.name}
          </option>
        ))}
        <option value="__other__">Other / custom…</option>
      </select>
      {!isKnown && (
        <input
          className={inputCls}
          placeholder="Type venue name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const { toasts, toast, dismiss } = useToasts();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const [members, setMembers] = useState<SiteRecord<MemberData>[]>([]);
  const [subs, setSubs] = useState<SiteRecord<SubscriptionData>[]>([]);
  const [bookings, setBookings] = useState<SiteRecord<BookingData>[]>([]);
  const [socials, setSocials] = useState<SiteRecord<SocialRegData>[]>([]);
  const [orders, setOrders] = useState<SiteRecord<ShopOrderData>[]>([]);
  const [products, setProducts] = useState<SiteRecord<ProductData>[]>([]);
  const [cms, setCms] = useState<SiteRecord<CmsContentData>[]>([]);
  const [franchisees, setFranchisees] = useState<SiteRecord<FranchiseeData>[]>([]);
  const [enquiries, setEnquiries] = useState<SiteRecord<FranchiseEnquiryData>[]>([]);

  const [editMember, setEditMember] = useState<SiteRecord<MemberData> | null>(null);
  const [editSub, setEditSub] = useState<SiteRecord<SubscriptionData> | null>(null);
  const [editBooking, setEditBooking] = useState<SiteRecord<BookingData> | null>(null);
  const [editFranchisee, setEditFranchisee] = useState<SiteRecord<FranchiseeData> | null>(
    null
  );
  const [savingModal, setSavingModal] = useState(false);

  const reload = useCallback(async () => {
    const [m, s, b, so, o, p, c, f, e] = await Promise.all([
      listRecords<MemberData>("members"),
      listRecords<SubscriptionData>("subscriptions"),
      listRecords<BookingData>("bookings"),
      listRecords<SocialRegData>("social_regs"),
      listRecords<ShopOrderData>("shop_orders"),
      listRecords<ProductData>("products"),
      listRecords<CmsContentData>("cms_content"),
      listRecords<FranchiseeData>("franchisees"),
      listRecords<FranchiseEnquiryData>("franchise_enquiries"),
    ]);

    // Always keep built-in HQ venues (Arnold House + Bilton) visible in Admin → Venues
    let cmsRows = c;
    let changed = false;
    for (const v of Object.values(VENUES)) {
      const match = (row: SiteRecord<CmsContentData>) =>
        row.data.content_type === "venue" &&
        (row.data.slug === v.id ||
          row.data.title === v.name ||
          parseJsonSafe<VenueBody>(row.data.body_json, { venueKey: "", address: "" })
            .venueKey === v.id);

      const active = cmsRows.find(
        (row) => match(row) && row.data.record_status !== "archived"
      );
      if (active) continue;

      const archived = cmsRows.find(
        (row) => match(row) && row.data.record_status === "archived"
      );
      try {
        if (archived) {
          await updateRecord<CmsContentData>("cms_content", archived.id, {
            title: v.name,
            summary: v.address,
            body_json: JSON.stringify({
              venueKey: v.id,
              address: v.address,
              mapsUrl: v.mapsUrl,
            } satisfies VenueBody),
            published: true,
            record_status: "active",
          });
          changed = true;
        } else {
          await createRecord<CmsContentData>("cms_content", {
            content_type: "venue",
            slug: v.id,
            title: v.name,
            summary: v.address,
            body_json: JSON.stringify({
              venueKey: v.id,
              address: v.address,
              mapsUrl: v.mapsUrl,
            } satisfies VenueBody),
            image_url: "",
            published: true,
            sort_order: v.id === "arnold-house" ? 1 : 2,
            record_status: "active",
          });
          changed = true;
        }
      } catch {
        /* ignore seed race / validation */
      }
    }
    if (changed) {
      cmsRows = await listRecords<CmsContentData>("cms_content");
    }

    setMembers(m);
    setSubs(s);
    setBookings(b);
    setSocials(so);
    setOrders(o);
    setProducts(p);
    setCms(cmsRows);
    setFranchisees(f);
    setEnquiries(e);
  }, []);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/account/login/?next=/admin/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      reload().catch((e) => toast(String(e), "err"));
    }
  }, [user, reload, toast]);

  const stats = useMemo(
    () => ({
      members: members.filter((m) => m.data.role === "dancer").length,
      activeSubs: subs.filter((s) => s.data.record_status === "active").length,
      bookings: bookings.length,
      orders: orders.filter((o) => o.data.record_status === "new").length,
      events: cms.filter((c) => c.data.content_type === "event").length,
      blogs: cms.filter((c) => c.data.content_type === "blog").length,
      franchisees: franchisees.filter((f) => f.data.record_status === "active").length,
      enquiries: enquiries.filter((e) => e.data.record_status === "new").length,
    }),
    [members, subs, bookings, orders, cms, franchisees, enquiries]
  );

  // Must stay above any early returns (Rules of Hooks)
  const venueOptions = useMemo(() => buildVenueOptions(cms), [cms]);

  async function flash(ok: string) {
    toast(ok, "ok");
    await reload();
  }

  async function hardDelete(collection: string, id: string, label: string) {
    const ok = await confirm({
      title: `Delete ${label}?`,
      message: `Permanently delete this ${label}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRecord(collection, id);
      await flash(`${label} deleted`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
    }
  }

  async function seedShop() {
    for (const p of PRODUCTS) {
      const exists = products.some((r) => r.data.sku === p.id);
      if (exists) continue;
      await createRecord<ProductData>("products", {
        sku: p.id,
        name: p.name,
        description: p.description,
        price_gbp: p.price,
        image_url: p.image,
        category: p.category,
        sizes_json: JSON.stringify(p.sizes),
        stock_json: JSON.stringify(p.stock),
        active: true,
        record_status: "active",
      });
    }
    await flash("Shop products seeded");
  }

  async function seedCmsBasics() {
    for (const v of Object.values(VENUES)) {
      if (cms.some((c) => c.data.content_type === "venue" && c.data.slug === v.id)) continue;
      await createRecord<CmsContentData>("cms_content", {
        content_type: "venue",
        slug: v.id,
        title: v.name,
        summary: v.address,
        body_json: JSON.stringify({
          venueKey: v.id,
          address: v.address,
          mapsUrl: v.mapsUrl,
        } satisfies VenueBody),
        image_url: "",
        published: true,
        sort_order: 1,
        record_status: "active",
      });
    }
    for (const cls of CLASSES) {
      if (cms.some((c) => c.data.content_type === "class" && c.data.slug === cls.id)) continue;
      const primary = cls.slots[0];
      await createRecord<CmsContentData>("cms_content", {
        content_type: "class",
        slug: cls.id,
        title: cls.title,
        summary: cls.level,
        body_json: JSON.stringify({
          classKey: cls.id,
          badge: cls.badge,
          duration: cls.duration,
          price: cls.price,
          level: cls.level,
          dayOfWeek: primary?.dayOfWeek ?? 1,
          time: primary?.time ?? "19:00",
          endTime: primary?.endTime ?? "20:30",
          description: cls.description,
          highlights: cls.highlights,
          venueId: primary?.venueId ?? "arnoldHouse",
          slots: cls.slots,
        }),
        image_url: cls.image,
        published: true,
        sort_order: 10,
        record_status: "active",
      });
    }
    for (const ev of EVENTS) {
      if (cms.some((c) => c.data.content_type === "event" && c.data.slug === ev.id)) continue;
      await createRecord<CmsContentData>("cms_content", {
        content_type: "event",
        slug: ev.id,
        title: ev.title,
        summary: ev.blurb,
        body_json: JSON.stringify({
          dateLabel: ev.dateLabel,
          dateISO: ev.dateISO,
          endDateISO: ev.endDateISO,
          time: ev.time,
          doors: ev.doors,
          venue: ev.venue,
          address: ev.address,
          eventStatus: ev.status,
          isSocial: ev.isSocial,
          level: ev.level,
          details: ev.details,
          tickets: ev.tickets,
        } satisfies EventBody),
        image_url: ev.image,
        published: true,
        sort_order: 20,
        record_status: "active",
      });
    }
    for (const post of BLOG_POSTS) {
      if (cms.some((c) => c.data.content_type === "blog" && c.data.slug === post.slug)) continue;
      await createRecord<CmsContentData>("cms_content", {
        content_type: "blog",
        slug: post.slug,
        title: post.title,
        summary: post.excerpt,
        body_json: JSON.stringify({
          date: post.date,
          readMins: post.readMins,
          sections: post.sections,
        } satisfies BlogBody),
        image_url: post.image,
        published: true,
        sort_order: 30,
        record_status: "active",
      });
    }
    await flash("Classes, venues, events and blogs seeded into CMS");
  }

  if (loading) {
    return (
      <section className="container-page py-36">
        <p className="text-muted">Checking admin access…</p>
      </section>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <section className="container-page py-36">
        <p className="text-muted">Redirecting to login…</p>
        <p className="mt-2 text-sm text-muted">
          Admin access required.{" "}
          <Link href="/account/login/?next=/admin/" className="text-accent">
            Log in
          </Link>
        </p>
      </section>
    );
  }

  const cmsOf = (type: CmsContentType) =>
    cms.filter((c) => c.data.content_type === type).sort((a, b) => a.data.sort_order - b.data.sort_order);

  return (
    <section className="container-page py-24 md:py-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label">Studio admin</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide md:text-5xl">Control centre</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Manage accounts, Direct Debits, bookings, schedule, events, blog, shop stock/sizes, and
            franchisees. Membership plan: £{SUBSCRIPTION_PLAN.amountGbp}/mo · 1 free class/week.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary !py-2 text-sm" onClick={() => seedShop()}>
            Seed shop
          </button>
          <button type="button" className="btn-secondary !py-2 text-sm" onClick={() => seedCmsBasics()}>
            Seed CMS
          </button>
          <Link href="/account/" className="btn-secondary !py-2 text-sm">
            My account
          </Link>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide ${
              tab === t.id ? "bg-accent text-bg" : "border border-line bg-white/5 text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "overview" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Dancer accounts", stats.members],
              ["Active DD memberships", stats.activeSubs],
              ["Class bookings", stats.bookings],
              ["Open shop orders", stats.orders],
              ["CMS events", stats.events],
              ["CMS blogs", stats.blogs],
              ["HQ expansion towns", cms.filter((c) => c.data.content_type === "hq_location" && c.data.record_status === "active" && c.data.published).length],
              ["Active franchisees", stats.franchisees],
              ["New franchise enquiries", stats.enquiries],
            ].map(([label, n]) => (
              <div key={label as string} className="card-surface p-5">
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-1 font-display text-4xl text-accent">{n}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "members" && (
          <AdminTable
            headers={["Name", "Email", "Role", "Sub status", "Actions"]}
            rows={members.map((m) => [
              m.data.name,
              m.data.email,
              m.data.role,
              m.data.subscription_status || "none",
              <div key={m.id} className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-bold text-accent"
                  onClick={async () => {
                    await updateRecord<MemberData>("members", m.id, {
                      role: m.data.role === "admin" ? "dancer" : "admin",
                    });
                    await flash("Role updated");
                  }}
                >
                  Toggle admin
                </button>
                <button
                  type="button"
                  className="text-xs font-bold text-muted"
                  onClick={() => setEditMember(m)}
                >
                  Edit account
                </button>
                <button
                  type="button"
                  className="text-xs font-bold text-red-400"
                  onClick={() => hardDelete("members", m.id, "account")}
                >
                  Delete
                </button>
              </div>,
            ])}
          />
        )}

        {tab === "subs" && (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Cash members stay <strong className="text-cream">pending_cash</strong> until you press
              Activate. Full account numbers are shown for Direct Debit setup. Use{" "}
              <strong className="text-cream">Deactivate / Finish</strong> to end benefits.
            </p>
            <AdminTable
              headers={["Mandate", "Member", "£/mo", "Status", "Bank details", "Actions"]}
              rows={subs.map((s) => [
                s.data.mandate_ref,
                <>
                  {s.data.member_name}
                  <div className="text-xs text-muted">{s.data.member_email}</div>
                  <div className="text-xs text-muted">{s.data.payment_method || "—"}</div>
                </>,
                `£${Number(s.data.amount_gbp).toFixed(2)}`,
                s.data.record_status,
                <span key={`${s.id}-bank`} className="text-xs">
                  {s.data.account_name}
                  <br />
                  Sort: {s.data.sort_code}
                  <br />
                  A/C: {s.data.account_number || s.data.account_last4 || "—"}
                </span>,
                <div key={s.id} className="flex flex-wrap gap-2">
                  {s.data.record_status !== "active" && (
                    <button
                      type="button"
                      className="text-xs font-bold text-accent"
                      onClick={async () => {
                        await updateRecord<SubscriptionData>("subscriptions", s.id, {
                          record_status: "active",
                          cancelled_at: "",
                        });
                        await updateRecord<MemberData>("members", s.data.member_id, {
                          subscription_status: "active",
                          subscription_id: s.id,
                        });
                        await flash("Subscription activated — free classes unlocked");
                      }}
                    >
                      Activate
                    </button>
                  )}
                  {s.data.record_status === "active" && (
                    <button
                      type="button"
                      className="text-xs font-bold text-red-400"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Finish membership?",
                          message:
                            "Free member class bookings from today onwards will become pay-at-class at full drop-in price.",
                          confirmLabel: "Finish membership",
                          danger: true,
                        });
                        if (!ok) return;
                        await updateRecord<SubscriptionData>("subscriptions", s.id, {
                          record_status: "finished",
                          cancelled_at: new Date().toISOString(),
                        });
                        await updateRecord<MemberData>("members", s.data.member_id, {
                          subscription_status: "cancelled",
                          period_end: "",
                        });
                        const today = new Date().toISOString().slice(0, 10);
                        const { converted } = await convertFreeBookingsAfterBenefits({
                          memberId: s.data.member_id,
                          memberEmail: s.data.member_email,
                          chargeFromDate: today,
                        });
                        await flash(
                          `Subscription deactivated / finished` +
                            (converted > 0
                              ? ` · ${converted} free booking(s) converted to pay-at-class`
                              : "")
                        );
                      }}
                    >
                      Deactivate / Finish
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs font-bold text-muted"
                    onClick={() => setEditSub(s)}
                  >
                    Edit DD details
                  </button>
                  <button
                    type="button"
                    className="text-xs font-bold text-red-400"
                    onClick={() => hardDelete("subscriptions", s.id, "subscription")}
                  >
                    Delete
                  </button>
                </div>,
              ])}
            />
            <StartSubForm members={members} onDone={flash} />
          </div>
        )}

        {tab === "bookings" && (
          <AdminTable
            headers={["Dancer", "Class", "When", "Pay", "Status", "Actions"]}
            rows={bookings.map((b) => [
              <>
                {b.data.member_name}
                <div className="text-xs text-muted">{b.data.member_email}</div>
                <div className="text-xs text-muted">id: {b.data.member_id?.slice(0, 12)}…</div>
              </>,
              b.data.class_title,
              `${formatDateUK(b.data.session_date)} ${b.data.session_time}`,
              `£${Number(b.data.amount_gbp).toFixed(2)} · ${b.data.payment_status}`,
              b.data.record_status,
              <div key={b.id} className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-bold text-accent"
                  onClick={async () => {
                    await updateRecord<BookingData>("bookings", b.id, {
                      record_status: "attended",
                      payment_status: "paid",
                    });
                    await flash("Marked attended/paid");
                  }}
                >
                  Attended
                </button>
                {(b.data.payment_status === "pay_at_class" ||
                  b.data.payment_method === "pay_at_class") &&
                  b.data.payment_status !== "paid" && (
                    <button
                      type="button"
                      className="text-xs font-bold text-accent"
                      onClick={async () => {
                        await updateRecord<BookingData>("bookings", b.id, {
                          payment_status: "paid",
                        });
                        await flash("Marked paid (pay at class)");
                      }}
                    >
                      Mark paid
                    </button>
                  )}
                <button
                  type="button"
                  className="text-xs font-bold text-muted"
                  onClick={() => setEditBooking(b)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs font-bold text-red-400"
                  onClick={async () => {
                    await updateRecord<BookingData>("bookings", b.id, {
                      record_status: "cancelled",
                    });
                    await flash("Booking cancelled");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="text-xs font-bold text-red-400"
                  onClick={() => hardDelete("bookings", b.id, "booking")}
                >
                  Delete
                </button>
              </div>,
            ])}
          />
        )}

        {tab === "schedule" && (
          <CmsCrud
            title="One-off / scheduled class dates"
            type="session"
            items={cmsOf("session")}
            defaults={(): {
              slug: string;
              title: string;
              summary: string;
              image_url: string;
              published: boolean;
              sort_order: number;
              body: SessionBody;
            } => ({
              slug: `session-${Date.now()}`,
              title: "Class session",
              summary: "",
              image_url: "",
              published: true,
              sort_order: 50,
              body: {
                classKey: CLASSES[0]?.id || "ultra-beginner",
                classTitle: CLASSES[0]?.title || "Class",
                date: new Date().toISOString().slice(0, 10),
                time: "19:00",
                endTime: "20:30",
                price: SITE.classPrice,
                venueName: SITE.venue,
                capacity: 40,
                notes: "",
              },
            })}
            fields={(body: SessionBody, setBody) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Class title">
                  <input
                    className={inputCls}
                    value={body.classTitle}
                    onChange={(e) => setBody({ ...body, classTitle: e.target.value })}
                  />
                </Field>
                <Field label="Class key">
                  <input
                    className={inputCls}
                    value={body.classKey}
                    onChange={(e) => setBody({ ...body, classKey: e.target.value })}
                  />
                </Field>
                <Field label="Date">
                  <input
                    type="date"
                    className={inputCls}
                    value={body.date}
                    onChange={(e) => setBody({ ...body, date: e.target.value })}
                  />
                </Field>
                <Field label="Time">
                  <input
                    className={inputCls}
                    value={body.time}
                    onChange={(e) => setBody({ ...body, time: e.target.value })}
                  />
                </Field>
                <Field label="Price £">
                  <input
                    type="number"
                    className={inputCls}
                    value={body.price}
                    onChange={(e) => setBody({ ...body, price: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Venue">
                  <VenueSelect
                    value={body.venueName || ""}
                    options={venueOptions}
                    onChange={(name) => setBody({ ...body, venueName: name })}
                  />
                </Field>
              </div>
            )}
            onChange={flash}
            confirm={confirm}
          />
        )}

        {tab === "classes" && (
          <CmsCrud
            title="Class types"
            type="class"
            items={cmsOf("class")}
            defaults={(): {
              slug: string;
              title: string;
              summary: string;
              image_url: string;
              published: boolean;
              sort_order: number;
              body: ClassBody;
            } => ({
              slug: `class-${Date.now()}`,
              title: "New class",
              summary: "Beginner",
              image_url: "/images/class-beginner.jpg",
              published: true,
              sort_order: 10,
              body: {
                classKey: `class-${Date.now()}`,
                duration: "1 hr 30 min",
                price: 10,
                level: "Beginner",
                dayOfWeek: 2,
                time: "19:00",
                endTime: "20:30",
                description: "",
                highlights: [],
              },
            })}
            fields={(body: ClassBody, setBody) => (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Level">
                  <input
                    className={inputCls}
                    value={body.level}
                    onChange={(e) => setBody({ ...body, level: e.target.value })}
                  />
                </Field>
                <Field label="Price £">
                  <input
                    type="number"
                    className={inputCls}
                    value={body.price}
                    onChange={(e) => setBody({ ...body, price: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Day of week (0=Sun…6=Sat)">
                  <input
                    type="number"
                    className={inputCls}
                    value={body.dayOfWeek}
                    onChange={(e) => setBody({ ...body, dayOfWeek: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Start time">
                  <input
                    className={inputCls}
                    value={body.time}
                    onChange={(e) => setBody({ ...body, time: e.target.value })}
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    className={inputCls}
                    rows={3}
                    value={body.description}
                    onChange={(e) => setBody({ ...body, description: e.target.value })}
                  />
                </Field>
              </div>
            )}
            onChange={flash}
            confirm={confirm}
          />
        )}

        {tab === "hq_towns" && (
          <HqTownsAdmin
            items={cmsOf("hq_location")}
            venueOptions={venueOptions}
            onChange={flash}
            confirm={confirm}
            toast={toast}
          />
        )}

        {tab === "gallery" && (
          <GalleryAdmin
            items={cmsOf("gallery")}
            onChange={flash}
            confirm={confirm}
            toast={toast}
          />
        )}

        {tab === "chat" && (
          <ChatChannelsAdmin onChange={flash} confirm={confirm} toast={toast} />
        )}

        {tab === "venues" && (
          <CmsCrud
            title="Venues"
            type="venue"
            items={cmsOf("venue").filter((c) => c.data.record_status !== "archived")}
            defaults={(): {
              slug: string;
              title: string;
              summary: string;
              image_url: string;
              published: boolean;
              sort_order: number;
              body: VenueBody;
            } => ({
              slug: `venue-${Date.now()}`,
              title: "New venue",
              summary: "",
              image_url: "",
              published: true,
              sort_order: 1,
              body: {
                venueKey: `venue-${Date.now()}`,
                address: "",
                mapsUrl: "",
                notes: "",
              },
            })}
            fields={(body: VenueBody, setBody) => (
              <div className="grid gap-3">
                <Field label="Address">
                  <input
                    className={inputCls}
                    value={body.address}
                    onChange={(e) => setBody({ ...body, address: e.target.value })}
                  />
                </Field>
                <Field label="Maps URL">
                  <input
                    className={inputCls}
                    value={body.mapsUrl || ""}
                    onChange={(e) => setBody({ ...body, mapsUrl: e.target.value })}
                  />
                </Field>
                <Field label="Notes">
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={body.notes || ""}
                    onChange={(e) => setBody({ ...body, notes: e.target.value })}
                  />
                </Field>
              </div>
            )}
            onChange={flash}
            confirm={confirm}
          />
        )}

        {tab === "events" && (
          <div className="space-y-8">
            <CmsCrud
              title="Socials & temporary events"
              type="event"
              items={cmsOf("event")}
              defaults={(): {
                slug: string;
                title: string;
                summary: string;
                image_url: string;
                published: boolean;
                sort_order: number;
                body: EventBody;
              } => ({
                slug: `event-${Date.now()}`,
                title: "New event",
                summary: "",
                image_url: "/images/event-summer.jpg",
                published: true,
                sort_order: 20,
                body: {
                  dateLabel: "TBC",
                  dateISO: new Date().toISOString().slice(0, 10),
                  time: "19:00 – 23:00",
                  doors: "",
                  venue: SITE.venue,
                  address: SITE.addressShort,
                  eventStatus: "open",
                  isSocial: true,
                  level: "All levels",
                  details: [],
                  tickets: [{ id: "ga", name: "General", price: 10 }],
                },
              })}
              fields={(body: EventBody, setBody) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date label">
                    <input
                      className={inputCls}
                      value={body.dateLabel}
                      onChange={(e) => setBody({ ...body, dateLabel: e.target.value })}
                    />
                  </Field>
                  <Field label="Date ISO">
                    <input
                      type="date"
                      className={inputCls}
                      value={body.dateISO}
                      onChange={(e) => setBody({ ...body, dateISO: e.target.value })}
                    />
                  </Field>
                  <Field label="Time">
                    <input
                      className={inputCls}
                      value={body.time}
                      onChange={(e) => setBody({ ...body, time: e.target.value })}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      className={inputCls}
                      value={body.eventStatus}
                      onChange={(e) =>
                        setBody({ ...body, eventStatus: e.target.value as "open" | "closed" })
                      }
                    >
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                    </select>
                  </Field>
                  <Field label="Quarterly social?">
                    <select
                      className={inputCls}
                      value={body.isSocial ? "yes" : "no"}
                      onChange={(e) => setBody({ ...body, isSocial: e.target.value === "yes" })}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No (workshop etc.)</option>
                    </select>
                  </Field>
                  <Field label="Venue">
                    <VenueSelect
                      value={body.venue}
                      options={venueOptions}
                      onChange={(name) => setBody({ ...body, venue: name })}
                      onPick={(v) =>
                        setBody({
                          ...body,
                          venue: v.name,
                          address: v.address || body.address,
                        })
                      }
                    />
                  </Field>
                </div>
              )}
              onChange={flash}
              confirm={confirm}
            />
            <div>
              <h3 className="font-display text-2xl tracking-wide">Social registrations / +1s</h3>
              <AdminTable
                headers={["Member", "Event", "Ticket", "+1", "Check-in", "Actions"]}
                rows={socials.map((s) => [
                  s.data.member_name,
                  s.data.event_title,
                  s.data.ticket_type,
                  s.data.plus_one_name || "—",
                  <button
                    key={s.id}
                    type="button"
                    className="text-xs font-bold text-accent"
                    onClick={async () => {
                      await updateRecord<SocialRegData>("social_regs", s.id, {
                        checked_in: !s.data.checked_in,
                      });
                      await flash("Check-in toggled");
                    }}
                  >
                    {s.data.checked_in ? "In ✓" : "Mark in"}
                  </button>,
                  <button
                    key={`${s.id}-del`}
                    type="button"
                    className="text-xs font-bold text-red-400"
                    onClick={() => hardDelete("social_regs", s.id, "registration")}
                  >
                    Delete
                  </button>,
                ])}
              />
            </div>
          </div>
        )}

        {tab === "blogs" && (
          <CmsCrud
            title="Blog posts"
            type="blog"
            items={cmsOf("blog")}
            defaults={(): {
              slug: string;
              title: string;
              summary: string;
              image_url: string;
              published: boolean;
              sort_order: number;
              body: BlogBody;
            } => ({
              slug: `post-${Date.now()}`,
              title: "New post",
              summary: "",
              image_url: "/images/blog-first-class.jpg",
              published: false,
              sort_order: 30,
              body: {
                date: new Date().toISOString().slice(0, 10),
                readMins: 3,
                sections: [{ title: "Introduction", body: "Write your post…" }],
              },
            })}
            fields={(body: BlogBody, setBody) => (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date">
                    <input
                      type="date"
                      className={inputCls}
                      value={body.date || ""}
                      onChange={(e) => setBody({ ...body, date: e.target.value })}
                    />
                  </Field>
                  <Field label="Read time (mins)">
                    <input
                      type="number"
                      className={inputCls}
                      value={body.readMins ?? 3}
                      onChange={(e) =>
                        setBody({ ...body, readMins: Number(e.target.value) || 1 })
                      }
                    />
                  </Field>
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">
                    Sections
                  </p>
                  {(body.sections || []).map((sec, i) => (
                    <div key={i} className="rounded-xl border border-line p-3 space-y-2">
                      <Field label={`Section ${i + 1} title`}>
                        <input
                          className={inputCls}
                          value={sec.title}
                          onChange={(e) => {
                            const sections = [...body.sections];
                            sections[i] = { ...sections[i], title: e.target.value };
                            setBody({ ...body, sections });
                          }}
                        />
                      </Field>
                      <Field label="Body">
                        <textarea
                          className={inputCls}
                          rows={4}
                          value={sec.body}
                          onChange={(e) => {
                            const sections = [...body.sections];
                            sections[i] = { ...sections[i], body: e.target.value };
                            setBody({ ...body, sections });
                          }}
                        />
                      </Field>
                      <button
                        type="button"
                        className="text-xs font-bold text-red-400"
                        onClick={() =>
                          setBody({
                            ...body,
                            sections: body.sections.filter((_, j) => j !== i),
                          })
                        }
                      >
                        Remove section
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary !py-1.5 text-xs"
                    onClick={() =>
                      setBody({
                        ...body,
                        sections: [
                          ...(body.sections || []),
                          { title: "New section", body: "" },
                        ],
                      })
                    }
                  >
                    Add section
                  </button>
                </div>
              </div>
            )}
            onChange={flash}
            confirm={confirm}
          />
        )}

        {tab === "shop" && (
          <div className="space-y-6">
            <ProductAdmin products={products} onChange={flash} confirm={confirm} toast={toast} />
          </div>
        )}

        {tab === "orders" && (
          <AdminTable
            headers={["Customer", "Items", "Total", "Status", "Actions"]}
            rows={orders.map((o) => [
              <>
                {o.data.customer_name}
                <div className="text-xs text-muted">{o.data.customer_email}</div>
              </>,
              <span key={o.id} className="text-xs">
                {o.data.items_json}
              </span>,
              `£${Number(o.data.total_gbp).toFixed(2)}`,
              o.data.record_status,
              <div key={`${o.id}-a`} className="flex gap-2">
                <button
                  type="button"
                  className="text-xs font-bold text-accent"
                  onClick={async () => {
                    await updateRecord<ShopOrderData>("shop_orders", o.id, {
                      record_status: "fulfilled",
                      payment_status: "paid",
                    });
                    await flash("Order fulfilled");
                  }}
                >
                  Fulfil
                </button>
                <button
                  type="button"
                  className="text-xs font-bold text-muted"
                  onClick={async () => {
                    await updateRecord<ShopOrderData>("shop_orders", o.id, {
                      record_status: "cancelled",
                    });
                    await flash("Order cancelled");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="text-xs font-bold text-red-400"
                  onClick={() => hardDelete("shop_orders", o.id, "order")}
                >
                  Delete
                </button>
              </div>,
            ])}
          />
        )}

        {tab === "payments" && <PaymentsAdmin onSaved={flash} toast={toast} />}

        {tab === "mailing" && (
          <MailingAdmin members={members} flash={flash} toast={toast} confirm={confirm} />
        )}

        {tab === "attendance" && (
          <AttendancePanel bookings={bookings} />
        )}

        {tab === "revenue" && (
          <RevenuePanel bookings={bookings} subs={subs} orders={orders} />
        )}

        {tab === "cancel_session" && (
          <CancelSessionPanel bookings={bookings} onDone={flash} confirm={confirm} />
        )}

        {tab === "franchise" && (
          <div className="space-y-10">
            <div className="card-surface p-5 text-sm text-muted">
              Package: £{FRANCHISE.upfrontFeeGbp.toLocaleString("en-GB")} upfront ·{" "}
              {FRANCHISE.royaltyPercent}% dance royalty + {FRANCHISE.brandFundPercent}% brand fund +{" "}
              <strong className="text-cream">{FRANCHISE.merchRoyaltyPercent}% merch royalty</strong>{" "}
              (merch is never royalty-free). Curriculum, speaker, 4-night stay & marketing included.{" "}
              <Link href="/franchise/" className="text-accent">
                /franchise/
              </Link>
            </div>
            <FranchiseVisibilityAdmin onSaved={flash} toast={toast} />
            <div>
              <h3 className="font-display text-2xl tracking-wide">Enquiries</h3>
              <AdminTable
                headers={["Name", "Area", "Email", "Status", "Actions"]}
                rows={enquiries.map((e) => [
                  e.data.full_name,
                  `${e.data.town_city}${e.data.region ? `, ${e.data.region}` : ""}`,
                  e.data.email,
                  e.data.record_status,
                  <div key={e.id} className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-bold text-accent"
                      onClick={async () => {
                        await updateRecord<FranchiseEnquiryData>("franchise_enquiries", e.id, {
                          record_status: "contacted",
                        });
                        await flash("Enquiry marked contacted");
                      }}
                    >
                      Contacted
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold text-accent"
                      onClick={async () => {
                        await createRecord<FranchiseeData>("franchisees", {
                          full_name: e.data.full_name,
                          email: e.data.email,
                          phone: e.data.phone || "",
                          town_city: e.data.town_city,
                          region: e.data.region || "",
                          territory: e.data.town_city,
                          started_at: new Date().toISOString().slice(0, 10),
                          upfront_fee_gbp: FRANCHISE.upfrontFeeGbp,
                          royalty_percent: FRANCHISE.royaltyPercent,
                          record_status: "active",
                          notes: e.data.message,
                        });
                        await updateRecord<FranchiseEnquiryData>("franchise_enquiries", e.id, {
                          record_status: "converted",
                        });
                        await flash("Converted to franchisee");
                      }}
                    >
                      Convert
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold text-red-400"
                      onClick={() => hardDelete("franchise_enquiries", e.id, "enquiry")}
                    >
                      Delete
                    </button>
                  </div>,
                ])}
              />
            </div>
            <div>
              <h3 className="font-display text-2xl tracking-wide">Active franchisees</h3>
              <AdminTable
                headers={["Name", "Territory", "Email", "Royalty", "Status", "Actions"]}
                rows={franchisees.map((f) => [
                  f.data.full_name,
                  `${f.data.town_city} · ${f.data.territory}`,
                  f.data.email,
                  `${f.data.royalty_percent}%`,
                  f.data.record_status,
                  <div key={f.id} className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-bold text-muted"
                      onClick={async () => {
                        await updateRecord<FranchiseeData>("franchisees", f.id, {
                          record_status:
                            f.data.record_status === "active" ? "paused" : "active",
                        });
                        await flash("Franchisee status updated");
                      }}
                    >
                      Toggle active
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold text-accent"
                      onClick={() => setEditFranchisee(f)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold text-red-400"
                      onClick={() => hardDelete("franchisees", f.id, "franchisee")}
                    >
                      Delete
                    </button>
                  </div>,
                ])}
              />
            </div>
          </div>
        )}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
      {confirmDialog}

      <MemberEditModal
        record={editMember}
        busy={savingModal}
        onClose={() => setEditMember(null)}
        onSave={async (data) => {
          if (!editMember) return;
          setSavingModal(true);
          try {
            if (data.email) {
              const email = String(data.email).trim().toLowerCase();
              if (!email.includes("@")) throw new Error("Enter a valid email address.");
              const conflict = members.find(
                (m) => m.id !== editMember.id && m.data.email.toLowerCase() === email
              );
              if (conflict) {
                throw new Error(`Email already used by ${conflict.data.name}.`);
              }
              data = { ...data, email };
            }
            await updateRecord<MemberData>("members", editMember.id, data);
            setEditMember(null);
            await flash("Account updated");
          } catch (e) {
            toast(e instanceof Error ? e.message : String(e), "err");
          } finally {
            setSavingModal(false);
          }
        }}
      />
      <SubscriptionEditModal
        record={editSub}
        busy={savingModal}
        onClose={() => setEditSub(null)}
        onSave={async (data) => {
          if (!editSub) return;
          setSavingModal(true);
          try {
            await updateRecord<SubscriptionData>("subscriptions", editSub.id, data);
            setEditSub(null);
            await flash("Subscription bank details updated");
          } catch (e) {
            toast(e instanceof Error ? e.message : String(e), "err");
          } finally {
            setSavingModal(false);
          }
        }}
      />
      <BookingEditModal
        record={editBooking}
        busy={savingModal}
        onClose={() => setEditBooking(null)}
        onSave={async (data) => {
          if (!editBooking) return;
          setSavingModal(true);
          try {
            await updateRecord<BookingData>("bookings", editBooking.id, data);
            setEditBooking(null);
            await flash("Booking updated");
          } catch (e) {
            toast(e instanceof Error ? e.message : String(e), "err");
          } finally {
            setSavingModal(false);
          }
        }}
      />
      <FranchiseeEditModal
        record={editFranchisee}
        busy={savingModal}
        venueOptions={venueOptions}
        onClose={() => setEditFranchisee(null)}
        onSave={async (data) => {
          if (!editFranchisee) return;
          setSavingModal(true);
          try {
            await updateRecord<FranchiseeData>("franchisees", editFranchisee.id, data);
            setEditFranchisee(null);
            await flash("Franchisee updated");
          } catch (e) {
            toast(e instanceof Error ? e.message : String(e), "err");
          } finally {
            setSavingModal(false);
          }
        }}
      />
    </section>
  );
}

function AdminTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-muted">
          <tr className="border-b border-line">
            {headers.map((h) => (
              <th key={h} className="py-3 pr-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="py-6 text-muted">
                No records yet.
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/50 align-top">
              {row.map((cell, j) => (
                <td key={j} className="py-3 pr-3 text-cream">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StartSubForm({
  members,
  onDone,
}: {
  members: SiteRecord<MemberData>[];
  onDone: (m: string) => Promise<void>;
}) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const memberId = String(fd.get("member_id"));
    const m = members.find((x) => x.id === memberId);
    if (!m) return;
    const amount = Number(fd.get("amount") || SUBSCRIPTION_PLAN.amountGbp);
    const method = String(fd.get("payment_method") || "direct_debit");
    const accNumRaw = String(fd.get("account_number") || "");
    const digits = accNumRaw.replace(/\D/g, "") || accNumRaw || "00000000";
    const activateNow = String(fd.get("activate") || "yes") === "yes";
    const sub = await createRecord<SubscriptionData>("subscriptions", {
      member_id: m.id,
      member_email: m.data.email,
      member_name: m.data.name,
      plan_id: SUBSCRIPTION_PLAN.id,
      amount_gbp: amount,
      record_status: activateNow ? "active" : "pending_cash",
      account_name: String(fd.get("account_name") || m.data.name),
      account_number: digits,
      account_last4: digits.slice(-4),
      sort_code: String(fd.get("sort_code") || "00-00-00"),
      mandate_ref: `BNB-ADMIN-${Date.now().toString(36).toUpperCase()}`,
      payment_method: method,
      started_at: new Date().toISOString(),
      next_collection_at: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    });
    await updateRecord<MemberData>("members", m.id, {
      subscription_status: activateNow ? "active" : "pending_cash",
      subscription_id: sub.id,
    });
    await onDone(activateNow ? "Subscription started & activated" : "Subscription created (pending)");
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="card-surface grid gap-3 p-5 sm:grid-cols-2">
      <h3 className="font-display text-xl tracking-wide sm:col-span-2">
        Start membership for member
      </h3>
      <Field label="Member">
        <select name="member_id" required className={inputCls}>
          <option value="">Select…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.data.name} ({m.data.email})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Amount £/mo">
        <input
          name="amount"
          type="number"
          defaultValue={SUBSCRIPTION_PLAN.amountGbp}
          className={inputCls}
        />
      </Field>
      <Field label="Payment method">
        <select name="payment_method" className={inputCls} defaultValue="direct_debit">
          <option value="direct_debit">Direct Debit</option>
          <option value="cash">Cash</option>
          <option value="paypal">PayPal / card</option>
        </select>
      </Field>
      <Field label="Activate now?">
        <select name="activate" className={inputCls} defaultValue="yes">
          <option value="yes">Yes — unlock free classes</option>
          <option value="no">No — leave pending (e.g. cash unpaid)</option>
        </select>
      </Field>
      <Field label="Account name">
        <input name="account_name" className={inputCls} />
      </Field>
      <Field label="Sort code">
        <input name="sort_code" placeholder="12-34-56" className={inputCls} />
      </Field>
      <Field label="Full account number">
        <input
          name="account_number"
          required
          placeholder="12345678"
          className={inputCls}
        />
      </Field>
      <div className="flex items-end sm:col-span-2">
        <button type="submit" className="btn-primary w-full !py-2 text-sm">
          Start subscription
        </button>
      </div>
    </form>
  );
}

function CmsCrud<TBody>({
  title,
  type,
  items,
  defaults,
  fields,
  onChange,
  confirm,
}: {
  title: string;
  type: CmsContentType;
  items: SiteRecord<CmsContentData>[];
  defaults: () => {
    slug: string;
    title: string;
    summary: string;
    image_url: string;
    published: boolean;
    sort_order: number;
    body: TBody;
  };
  fields: (body: TBody, setBody: (b: TBody) => void) => ReactNode;
  onChange: (msg: string) => Promise<void>;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
}) {
  const d0 = defaults();
  const [titleVal, setTitleVal] = useState(d0.title);
  const [slug, setSlug] = useState(d0.slug);
  const [summary, setSummary] = useState(d0.summary);
  const [image, setImage] = useState(d0.image_url);
  const [published, setPublished] = useState(d0.published);
  const [body, setBody] = useState<TBody>(d0.body);

  const [editItem, setEditItem] = useState<SiteRecord<CmsContentData> | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editPublished, setEditPublished] = useState(true);
  const [editBody, setEditBody] = useState<TBody>(d0.body);
  const [editBusy, setEditBusy] = useState(false);

  function openEdit(item: SiteRecord<CmsContentData>) {
    setEditItem(item);
    setEditTitle(item.data.title);
    setEditSlug(item.data.slug);
    setEditSummary(item.data.summary || "");
    setEditImage(item.data.image_url || "");
    setEditPublished(!!item.data.published);
    setEditBody(parseJsonSafe<TBody>(item.data.body_json, defaults().body));
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    await createRecord<CmsContentData>("cms_content", {
      content_type: type,
      slug,
      title: titleVal,
      summary,
      body_json: JSON.stringify(body),
      image_url: image,
      published,
      sort_order: d0.sort_order,
      record_status: published ? "active" : "draft",
    });
    await onChange(`${type} created`);
    const n = defaults();
    setTitleVal(n.title);
    setSlug(n.slug);
    setSummary(n.summary);
    setImage(n.image_url);
    setPublished(n.published);
    setBody(n.body);
  }

  async function saveEdit() {
    if (!editItem) return;
    setEditBusy(true);
    try {
      await updateRecord<CmsContentData>("cms_content", editItem.id, {
        title: editTitle,
        slug: editSlug,
        summary: editSummary,
        image_url: editImage,
        body_json: JSON.stringify(editBody),
        published: editPublished,
        record_status: editPublished ? "active" : "draft",
      });
      setEditItem(null);
      await onChange("Content updated");
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="font-display text-2xl tracking-wide">{title}</h3>
      <AdminTable
        headers={["Title", "Slug", "Published", "Actions"]}
        rows={items.map((item) => [
          item.data.title,
          item.data.slug,
          item.data.published ? "Yes" : "No",
          <div key={item.id} className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs font-bold text-accent"
              onClick={() => openEdit(item)}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-xs font-bold text-muted"
              onClick={async () => {
                await updateRecord<CmsContentData>("cms_content", item.id, {
                  published: !item.data.published,
                  record_status: !item.data.published ? "active" : "draft",
                });
                await onChange("Publish toggled");
              }}
            >
              {item.data.published ? "Unpublish" : "Publish"}
            </button>
            <button
              type="button"
              className="text-xs font-bold text-muted"
              onClick={async () => {
                await updateRecord<CmsContentData>("cms_content", item.id, {
                  record_status: "archived",
                  published: false,
                });
                await onChange("Archived");
              }}
            >
              Archive
            </button>
            <button
              type="button"
              className="text-xs font-bold text-red-400"
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${type}?`,
                  message: `Permanently delete “${item.data.title}”? This cannot be undone.`,
                  confirmLabel: "Delete",
                  danger: true,
                });
                if (!ok) return;
                await deleteRecord("cms_content", item.id);
                await onChange(`${type} deleted`);
              }}
            >
              Delete
            </button>
          </div>,
        ])}
      />
      <form onSubmit={create} className="card-surface space-y-3 p-5">
        <h4 className="font-display text-xl tracking-wide">Add new</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <input
              className={inputCls}
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              required
            />
          </Field>
          <Field label="Slug">
            <input
              className={inputCls}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </Field>
          <Field label="Summary">
            <input
              className={inputCls}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </Field>
        </div>
        <ImageUploadField label="Cover image (upload or URL)" value={image} onChange={setImage} />
        {fields(body, setBody)}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Published
        </label>
        <button type="submit" className="btn-primary !py-2 text-sm">
          Create {type}
        </button>
      </form>

      <Modal
        open={!!editItem}
        title={`Edit ${type}`}
        description={editItem ? editItem.data.slug : undefined}
        onClose={() => setEditItem(null)}
        wide
        footer={
          <>
            <button
              type="button"
              className="btn-secondary !py-2 text-sm"
              disabled={editBusy}
              onClick={() => setEditItem(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary !py-2 text-sm disabled:opacity-50"
              disabled={editBusy}
              onClick={() => saveEdit()}
            >
              {editBusy ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <input
                className={inputCls}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </Field>
            <Field label="Slug">
              <input
                className={inputCls}
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
              />
            </Field>
            <Field label="Summary">
              <input
                className={inputCls}
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
              />
            </Field>
          </div>
          <ImageUploadField
            label="Cover image (upload or URL)"
            value={editImage}
            onChange={setEditImage}
          />
          {fields(editBody, setEditBody)}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editPublished}
              onChange={(e) => setEditPublished(e.target.checked)}
            />
            Published
          </label>
        </div>
      </Modal>
    </div>
  );
}

function FranchiseVisibilityAdmin({
  onSaved,
  toast,
}: {
  onSaved: (m: string) => Promise<void>;
  toast: (m: string, k?: "ok" | "err") => void;
}) {
  const [settings, setSettings] = useState<SiteVisibilitySettings>(DEFAULT_SITE_VISIBILITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSiteVisibility()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await saveSiteVisibility(settings);
      await onSaved(
        settings.franchisePagePublic
          ? "Franchise page is now public (page + navbar)"
          : "Franchise page hidden from public (page + navbar)"
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted">Loading visibility settings…</p>;

  return (
    <div className="card-surface space-y-4 p-5">
      <h3 className="font-display text-2xl tracking-wide">Public visibility</h3>
      <p className="text-sm text-muted">
        When off, the Franchise link is removed from the navbar and footer, the home page
        teaser is hidden, and visitors to <code className="text-cream">/franchise/</code>{" "}
        are redirected home. Admins can still open the page and manage franchisees here.
      </p>
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={settings.franchisePagePublic}
          onChange={(e) =>
            setSettings({ ...settings, franchisePagePublic: e.target.checked })
          }
        />
        Show Franchise page publicly (navbar, footer, and page)
      </label>
      <button
        type="button"
        disabled={saving}
        className="btn-primary !py-2 text-sm disabled:opacity-50"
        onClick={() => save()}
      >
        {saving ? "Saving…" : "Save visibility"}
      </button>
    </div>
  );
}

function PaymentsAdmin({
  onSaved,
  toast,
}: {
  onSaved: (m: string) => Promise<void>;
  toast: (m: string, k?: "ok" | "err") => void;
}) {
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPaymentSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await savePaymentSettings(settings);
      await onSaved("Payment & email settings saved");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted">Loading payment settings…</p>;

  return (
    <form onSubmit={save} className="card-surface max-w-2xl space-y-4 p-6">
      <h3 className="font-display text-2xl tracking-wide">PayPal / card checkout</h3>
      <p className="text-sm text-muted">
        Create a REST app at{" "}
        <a
          href="https://developer.paypal.com/dashboard/applications"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline"
        >
          developer.paypal.com
        </a>
        . For monthly membership, also create a <strong>Billing Plan</strong> at £
        {SUBSCRIPTION_PLAN.amountGbp}/month and paste the Plan ID (starts with P-).
      </p>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
        />
        Enable online card / PayPal payments
      </label>
      <Field label="PayPal Client ID">
        <input
          className={inputCls}
          value={settings.paypalClientId}
          onChange={(e) => setSettings({ ...settings, paypalClientId: e.target.value })}
          placeholder="AYxxxxxxxx… (sandbox or live)"
        />
      </Field>
      <Field label="PayPal Subscription Plan ID (monthly membership)">
        <input
          className={inputCls}
          value={settings.paypalSubscriptionPlanId}
          onChange={(e) =>
            setSettings({ ...settings, paypalSubscriptionPlanId: e.target.value })
          }
          placeholder="P-xxxxxxxx"
        />
      </Field>
      <Field label="Mode">
        <select
          className={inputCls}
          value={settings.paypalMode}
          onChange={(e) =>
            setSettings({
              ...settings,
              paypalMode: e.target.value as "sandbox" | "live",
            })
          }
        >
          <option value="sandbox">Sandbox (test)</option>
          <option value="live">Live (real payments)</option>
        </select>
      </Field>
      <Field label="Currency">
        <input
          className={inputCls}
          value={settings.currency}
          onChange={(e) => setSettings({ ...settings, currency: e.target.value.toUpperCase() })}
        />
      </Field>

      <hr className="border-line" />
      <h3 className="font-display text-2xl tracking-wide">Resend.com (session emails)</h3>
      <p className="text-sm text-muted">
        Used for <strong className="text-cream">magic-link sign-in</strong> and session cancellation
        emails. Get an API key at{" "}
        <a
          href="https://resend.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline"
        >
          resend.com
        </a>
        . Prefer setting <code className="text-cream">RESEND_API_KEY</code> as a here.now account
        variable (with the site&apos;s <code className="text-cream">/api/email</code> proxy) so the
        key is not stored in public Site Data.
      </p>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={settings.resendEnabled}
          onChange={(e) => setSettings({ ...settings, resendEnabled: e.target.checked })}
        />
        Enable transactional email (magic links + session cancels)
      </label>
      <Field label="Resend API key">
        <input
          className={inputCls}
          type="password"
          autoComplete="off"
          value={settings.resendApiKey}
          onChange={(e) => setSettings({ ...settings, resendApiKey: e.target.value })}
          placeholder="re_xxxxxxxx"
        />
      </Field>
      <Field label="From email">
        <input
          className={inputCls}
          value={settings.resendFromEmail}
          onChange={(e) => setSettings({ ...settings, resendFromEmail: e.target.value })}
          placeholder="Boots N Boogie <hello@yourdomain.com>"
        />
      </Field>

      <Field label="Internal notes">
        <textarea
          className={inputCls}
          rows={2}
          value={settings.notes}
          onChange={(e) => setSettings({ ...settings, notes: e.target.value })}
        />
      </Field>
      <p className="text-xs text-muted">{BLACKOUT_NOTE}</p>
      <button type="submit" disabled={saving} className="btn-primary !py-2 text-sm disabled:opacity-50">
        {saving ? "Saving…" : "Save payment & email settings"}
      </button>
    </form>
  );
}

function AttendancePanel({ bookings }: { bookings: SiteRecord<BookingData>[] }) {
  const rows = useMemo(() => {
    const map = new Map<
      string,
      { date: string; time: string; title: string; confirmed: number; paid: number; free: number }
    >();
    for (const b of bookings) {
      if (b.data.record_status === "cancelled") continue;
      const key = `${b.data.session_date}|${b.data.session_time}|${b.data.class_title}`;
      const cur = map.get(key) || {
        date: b.data.session_date,
        time: b.data.session_time,
        title: b.data.class_title,
        confirmed: 0,
        paid: 0,
        free: 0,
      };
      cur.confirmed += 1;
      if (b.data.payment_status === "paid" || b.data.payment_status === "complimentary") cur.paid += 1;
      if (b.data.payment_method === "membership_free") cur.free += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) =>
      a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
    );
  }, [bookings]);

  return (
    <div className="space-y-4">
      <h3 className="font-display text-2xl tracking-wide">Booked numbers by day / class</h3>
      <p className="text-sm text-muted">Confirmed (non-cancelled) bookings only.</p>
      <AdminTable
        headers={["Date", "Time", "Class", "Booked", "Paid/comp", "Free member"]}
        rows={rows.map((r) => [
          formatDateUK(r.date),
          r.time,
          r.title,
          <strong key="n" className="text-accent text-lg">
            {r.confirmed}
          </strong>,
          r.paid,
          r.free,
        ])}
      />
    </div>
  );
}

function RevenuePanel({
  bookings,
  subs,
  orders,
}: {
  bookings: SiteRecord<BookingData>[];
  subs: SiteRecord<SubscriptionData>[];
  orders: SiteRecord<ShopOrderData>[];
}) {
  const stats = useMemo(() => {
    let classPaid = 0;
    let classPayAtClassOutstanding = 0;
    let classFree = 0;
    for (const b of bookings) {
      if (b.data.record_status === "cancelled") continue;
      const amt = Number(b.data.amount_gbp) || 0;
      if (b.data.payment_method === "membership_free" || amt === 0) {
        classFree += 1;
        continue;
      }
      if (b.data.payment_status === "paid") classPaid += amt;
      else if (b.data.payment_status === "pay_at_class") classPayAtClassOutstanding += amt;
      else if (b.data.payment_status === "pending") classPayAtClassOutstanding += amt;
    }

    let subActiveMonthly = 0;
    let subCashPending = 0;
    let subCountActive = 0;
    for (const s of subs) {
      const amt = Number(s.data.amount_gbp) || 0;
      if (s.data.record_status === "active") {
        subActiveMonthly += amt;
        subCountActive += 1;
      } else if (s.data.record_status === "pending_cash") {
        subCashPending += amt;
      }
    }

    let shopPaid = 0;
    let shopOutstanding = 0;
    for (const o of orders) {
      if (o.data.record_status === "cancelled") continue;
      const amt = Number(o.data.total_gbp) || 0;
      if (o.data.payment_status === "paid") shopPaid += amt;
      else shopOutstanding += amt;
    }

    const combinedReceived = classPaid + subActiveMonthly + shopPaid;
    const combinedPipeline =
      classPaid +
      classPayAtClassOutstanding +
      subActiveMonthly +
      subCashPending +
      shopPaid +
      shopOutstanding;

    return {
      classPaid,
      classPayAtClassOutstanding,
      classFree,
      subActiveMonthly,
      subCashPending,
      subCountActive,
      shopPaid,
      shopOutstanding,
      combinedReceived,
      combinedPipeline,
    };
  }, [bookings, subs, orders]);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-2xl tracking-wide">Combined income snapshot</h3>
        <p className="mt-1 text-sm text-muted">
          Indicative totals from Site Data (not a full accounting ledger). Active subscriptions shown
          as monthly run-rate.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Received / active MRR-style", stats.combinedReceived],
            ["Pipeline (incl. outstanding)", stats.combinedPipeline],
            ["Active paying members", stats.subCountActive],
          ].map(([label, n]) => (
            <div key={label as string} className="card-surface p-5">
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-1 font-display text-3xl text-accent">
                {typeof n === "number" && label !== "Active paying members"
                  ? `£${n.toFixed(2)}`
                  : n}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-xl tracking-wide">Classes & memberships</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Class fees paid" value={`£${stats.classPaid.toFixed(2)}`} />
          <StatCard
            label="Pay-at-class outstanding"
            value={`£${stats.classPayAtClassOutstanding.toFixed(2)}`}
          />
          <StatCard label="Free member bookings" value={String(stats.classFree)} />
          <StatCard
            label="Subscription monthly (active)"
            value={`£${stats.subActiveMonthly.toFixed(2)}`}
          />
          <StatCard label="Cash subs pending" value={`£${stats.subCashPending.toFixed(2)}`} />
        </div>
      </div>

      <div>
        <h3 className="font-display text-xl tracking-wide">Shop (separate)</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <StatCard label="Shop paid" value={`£${stats.shopPaid.toFixed(2)}`} />
          <StatCard label="Shop outstanding" value={`£${stats.shopOutstanding.toFixed(2)}`} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl text-accent">{value}</p>
    </div>
  );
}

function CancelSessionPanel({
  bookings,
  onDone,
  confirm,
}: {
  bookings: SiteRecord<BookingData>[];
  onDone: (m: string) => Promise<void>;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
}) {
  const sessions = useMemo(() => upcomingSessions(6), []);
  const [sessionKey, setSessionKey] = useState("");
  const [reason, setReason] = useState("Cancelled due to instructor illness");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);

  const selected = sessions.find((s) => s.key === sessionKey);
  const attendees = useMemo(() => {
    if (!selected) return [];
    return bookings.filter(
      (b) =>
        b.data.record_status !== "cancelled" &&
        b.data.session_date === selected.date &&
        b.data.session_time === selected.time &&
        b.data.class_id === selected.classId
    );
  }, [bookings, selected]);

  async function cancelAndEmail() {
    if (!selected) return;
    const ok = await confirm({
      title: "Cancel class session?",
      message: `Cancel ${selected.title} on ${formatDateUK(selected.date)} and email ${attendees.length} dancers?`,
      confirmLabel: "Cancel session & notify",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setLog(null);
    try {
      await createRecord<CmsContentData>("cms_content", {
        content_type: "session_cancel",
        slug: `cancel-${selected.key}`,
        title: `Cancelled: ${selected.title} ${formatDateUK(selected.date)}`,
        summary: reason,
        body_json: JSON.stringify({
          sessionKey: selected.key,
          date: selected.date,
          classId: selected.classId,
          time: selected.time,
          reason,
        }),
        image_url: "",
        published: true,
        sort_order: 0,
        record_status: "active",
      });

      for (const b of attendees) {
        await updateRecord<BookingData>("bookings", b.id, {
          record_status: "cancelled",
          notes: `${b.data.notes || ""} · Studio cancelled: ${reason}`.trim(),
        });
      }

      const settings = await loadPaymentSettings();
      const emails = [
        ...new Set(attendees.map((a) => a.data.member_email).filter(Boolean)),
      ];
      let emailNote = "No email sent.";
      if (settings.resendEnabled && settings.resendApiKey && emails.length) {
        const result = await sendResendEmail({
          apiKey: settings.resendApiKey,
          from: settings.resendFromEmail,
          to: emails,
          subject: `Class cancelled: ${selected.title} on ${formatDateUK(selected.date)}`,
          html: `<p>Hi,</p><p>We're sorry — <strong>${selected.title}</strong> on <strong>${formatDateUK(selected.date)} at ${selected.time}</strong> at ${selected.venueName} has been cancelled.</p><p><strong>Reason:</strong> ${reason}</p><p>Your booking has been cancelled. Please rebook another session when you can.</p><p>— Boots N Boogie</p>`,
        });
        emailNote = result.ok
          ? `Emailed ${emails.length} dancers via Resend.`
          : `Email failed: ${result.error}`;
      } else if (!settings.resendEnabled) {
        emailNote = "Resend disabled — configure Admin → Payments / email.";
      }

      setLog(`Session cancelled. ${attendees.length} bookings cancelled. ${emailNote}`);
      await onDone("Session cancelled");
    } catch (e) {
      setLog(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-surface max-w-2xl space-y-4 p-6">
      <h3 className="font-display text-2xl tracking-wide">Cancel a session</h3>
      <p className="text-sm text-muted">
        Marks the session unavailable for new bookings, cancels existing bookings, and emails
        dancers if Resend is configured.
      </p>
      <Field label="Session">
        <select
          className={inputCls}
          value={sessionKey}
          onChange={(e) => setSessionKey(e.target.value)}
        >
          <option value="">Select…</option>
          {sessions.map((s) => (
            <option key={s.key} value={s.key}>
              {formatDateUK(s.date)} {s.time} — {s.title} ({s.venueName})
            </option>
          ))}
        </select>
      </Field>
      {selected && (
        <p className="text-sm text-cream">
          Currently booked: <strong className="text-accent">{attendees.length}</strong>
        </p>
      )}
      <Field label="Reason (included in email)">
        <textarea
          className={inputCls}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <button
        type="button"
        disabled={busy || !sessionKey}
        onClick={cancelAndEmail}
        className="btn-primary !py-2 text-sm disabled:opacity-50"
      >
        {busy ? "Working…" : "Cancel session & notify"}
      </button>
      {log && <p className="text-sm text-accent">{log}</p>}
    </div>
  );
}

function ProductAdmin({
  products,
  onChange,
  confirm,
  toast,
}: {
  products: SiteRecord<ProductData>[];
  onChange: (m: string) => Promise<void>;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  toast: (m: string, k?: "ok" | "err") => void;
}) {
  const [newImage, setNewImage] = useState("/images/shop-tshirt.jpg");
  const [edit, setEdit] = useState<SiteRecord<ProductData> | null>(null);
  const [form, setForm] = useState({
    name: "",
    price: 0,
    description: "",
    category: "",
    image: "",
    sizesCsv: "",
    stock: {} as Record<string, number>,
    active: true,
  });
  const [busy, setBusy] = useState(false);

  function openEdit(p: SiteRecord<ProductData>) {
    const sizes = parseJsonSafe<string[]>(p.data.sizes_json, []);
    const stock = parseJsonSafe<Record<string, number>>(p.data.stock_json, {});
    setEdit(p);
    setForm({
      name: p.data.name,
      price: Number(p.data.price_gbp),
      description: p.data.description || "",
      category: p.data.category || "",
      image: p.data.image_url || "",
      sizesCsv: sizes.join(", "),
      stock,
      active: p.data.active !== false,
    });
  }

  function sizesList() {
    return form.sizesCsv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    try {
      const sizes = sizesList();
      const stock: Record<string, number> = {};
      for (const s of sizes) stock[s] = Number(form.stock[s] ?? 0);
      await updateRecord<ProductData>("products", edit.id, {
        name: form.name,
        price_gbp: Number(form.price),
        description: form.description,
        category: form.category,
        image_url: form.image,
        sizes_json: JSON.stringify(sizes),
        stock_json: JSON.stringify(stock),
        active: form.active,
        record_status: form.active ? "active" : "archived",
      });
      setEdit(null);
      await onChange("Product updated");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sizes = String(fd.get("sizes") || "S,M,L")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const stock: Record<string, number> = {};
    for (const s of sizes) stock[s] = Number(fd.get("stock_default") || 10);
    await createRecord<ProductData>("products", {
      sku: String(fd.get("sku")),
      name: String(fd.get("name")),
      description: String(fd.get("description") || ""),
      price_gbp: Number(fd.get("price")),
      image_url: newImage || String(fd.get("image") || "/images/shop-tshirt.jpg"),
      category: String(fd.get("category") || "Apparel"),
      sizes_json: JSON.stringify(sizes),
      stock_json: JSON.stringify(stock),
      active: true,
      record_status: "active",
    });
    await onChange("Product created");
    e.currentTarget.reset();
    setNewImage("/images/shop-tshirt.jpg");
  }

  return (
    <div className="space-y-6">
      <h3 className="font-display text-2xl tracking-wide">Products, sizes & stock</h3>
      <AdminTable
        headers={["SKU", "Name", "Price", "Sizes / stock", "Active", "Actions"]}
        rows={products.map((p) => {
          const sizes = parseJsonSafe<string[]>(p.data.sizes_json, []);
          const stock = parseJsonSafe<Record<string, number>>(p.data.stock_json, {});
          return [
            p.data.sku,
            p.data.name,
            `£${Number(p.data.price_gbp).toFixed(2)}`,
            sizes.map((s) => `${s}:${stock[s] ?? 0}`).join(" · "),
            p.data.active === false ? "No" : "Yes",
            <div key={p.id} className="flex flex-wrap gap-2">
              <button
                type="button"
                className="text-xs font-bold text-accent"
                onClick={() => openEdit(p)}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-xs font-bold text-muted"
                onClick={async () => {
                  await updateRecord<ProductData>("products", p.id, {
                    active: false,
                    record_status: "archived",
                  });
                  await onChange("Product archived");
                }}
              >
                Archive
              </button>
              <button
                type="button"
                className="text-xs font-bold text-red-400"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete product?",
                    message: `Permanently delete “${p.data.name}”? This cannot be undone.`,
                    confirmLabel: "Delete",
                    danger: true,
                  });
                  if (!ok) return;
                  await deleteRecord("products", p.id);
                  await onChange("Product deleted");
                }}
              >
                Delete
              </button>
            </div>,
          ];
        })}
      />
      <form onSubmit={create} className="card-surface grid gap-3 p-5 sm:grid-cols-2">
        <h4 className="font-display text-xl tracking-wide sm:col-span-2">Add product</h4>
        <Field label="SKU">
          <input name="sku" required className={inputCls} placeholder="midnight-boogie-tee" />
        </Field>
        <Field label="Name">
          <input name="name" required className={inputCls} />
        </Field>
        <Field label="Price £">
          <input name="price" type="number" step="0.01" required className={inputCls} />
        </Field>
        <Field label="Category">
          <input name="category" defaultValue="Apparel" className={inputCls} />
        </Field>
        <Field label="Sizes (comma-separated)">
          <input name="sizes" defaultValue="XS,S,M,L,XL,XXL" className={inputCls} />
        </Field>
        <Field label="Default stock per size">
          <input name="stock_default" type="number" defaultValue={10} className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <ImageUploadField label="Product image" value={newImage} onChange={setNewImage} />
        </div>
        <Field label="Description">
          <input name="description" className={inputCls} />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary !py-2 text-sm">
            Create product
          </button>
        </div>
      </form>

      <Modal
        open={!!edit}
        title="Edit product"
        description={edit?.data.sku}
        onClose={() => setEdit(null)}
        wide
        footer={
          <>
            <button
              type="button"
              className="btn-secondary !py-2 text-sm"
              disabled={busy}
              onClick={() => setEdit(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary !py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() => saveEdit()}
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Price £">
            <input
              type="number"
              step="0.01"
              className={inputCls}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
          </Field>
          <Field label="Category">
            <input
              className={inputCls}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </Field>
          <Field label="Sizes (comma-separated)">
            <input
              className={inputCls}
              value={form.sizesCsv}
              onChange={(e) => {
                const sizesCsv = e.target.value;
                const sizes = sizesCsv
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                const stock = { ...form.stock };
                for (const s of sizes) if (stock[s] == null) stock[s] = 0;
                setForm({ ...form, sizesCsv, stock });
              }}
            />
          </Field>
          <div className="sm:col-span-2">
            <ImageUploadField
              label="Product image"
              value={form.image}
              onChange={(image) => setForm({ ...form, image })}
            />
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                className={inputCls}
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Stock per size</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {sizesList().map((s) => (
                <Field key={s} label={s}>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.stock[s] ?? 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        stock: { ...form.stock, [s]: Number(e.target.value) },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Active in shop
          </label>
        </div>
      </Modal>
    </div>
  );
}

function MemberEditModal({
  record,
  busy,
  onClose,
  onSave,
}: {
  record: SiteRecord<MemberData> | null;
  busy: boolean;
  onClose: () => void;
  onSave: (data: Partial<MemberData>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sub, setSub] = useState("none");
  const [role, setRole] = useState("dancer");

  useEffect(() => {
    if (!record) return;
    setName(record.data.name);
    setEmail(record.data.email);
    setPhone(record.data.phone || "");
    setSub(record.data.subscription_status || "none");
    setRole(record.data.role || "dancer");
  }, [record]);

  return (
    <Modal
      open={!!record}
      title="Edit account"
      description={record?.data.email}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary !py-2 text-sm" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary !py-2 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              onSave({
                name,
                email: email.trim().toLowerCase(),
                phone,
                subscription_status: sub,
                role,
              })
            }
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" hint="Used for magic-link sign-in">
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Role">
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="dancer">Dancer</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Subscription status">
          <select className={inputCls} value={sub} onChange={(e) => setSub(e.target.value)}>
            <option value="none">none</option>
            <option value="pending_cash">pending_cash</option>
            <option value="active">active</option>
            <option value="cancelling">cancelling</option>
            <option value="cancelled">cancelled</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function SubscriptionEditModal({
  record,
  busy,
  onClose,
  onSave,
}: {
  record: SiteRecord<SubscriptionData> | null;
  busy: boolean;
  onClose: () => void;
  onSave: (data: Partial<SubscriptionData>) => Promise<void>;
}) {
  const [amount, setAmount] = useState(40);
  const [accName, setAccName] = useState("");
  const [sort, setSort] = useState("");
  const [accNum, setAccNum] = useState("");

  useEffect(() => {
    if (!record) return;
    setAmount(Number(record.data.amount_gbp) || 40);
    setAccName(record.data.account_name || "");
    setSort(record.data.sort_code || "");
    setAccNum(record.data.account_number || record.data.account_last4 || "");
  }, [record]);

  return (
    <Modal
      open={!!record}
      title="Edit Direct Debit details"
      description={record ? `${record.data.member_name} · ${record.data.mandate_ref}` : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary !py-2 text-sm" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary !py-2 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() => {
              const digits = accNum.replace(/\D/g, "") || accNum;
              onSave({
                amount_gbp: Number(amount),
                account_name: accName,
                sort_code: sort,
                account_number: digits,
                account_last4: digits.slice(-4),
              });
            }}
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Monthly amount £">
          <input
            type="number"
            step="0.01"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </Field>
        <Field label="Account name">
          <input className={inputCls} value={accName} onChange={(e) => setAccName(e.target.value)} />
        </Field>
        <Field label="Sort code">
          <input
            className={inputCls}
            placeholder="12-34-56"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          />
        </Field>
        <Field label="Full account number">
          <input className={inputCls} value={accNum} onChange={(e) => setAccNum(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function BookingEditModal({
  record,
  busy,
  onClose,
  onSave,
}: {
  record: SiteRecord<BookingData> | null;
  busy: boolean;
  onClose: () => void;
  onSave: (data: Partial<BookingData>) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState("confirmed");
  const [payStatus, setPayStatus] = useState("pay_at_class");

  useEffect(() => {
    if (!record) return;
    setTitle(record.data.class_title);
    setDate(record.data.session_date);
    setTime(record.data.session_time);
    setAmount(Number(record.data.amount_gbp) || 0);
    setStatus(record.data.record_status);
    setPayStatus(record.data.payment_status);
  }, [record]);

  return (
    <Modal
      open={!!record}
      title="Edit booking"
      description={record ? `${record.data.member_name} · ${record.data.member_email}` : undefined}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary !py-2 text-sm" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary !py-2 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              onSave({
                class_title: title,
                session_date: date,
                session_time: time,
                amount_gbp: Number(amount),
                record_status: status,
                payment_status: payStatus,
              })
            }
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Class title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Amount £">
          <input
            type="number"
            step="0.01"
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </Field>
        <Field label="Session date">
          <input
            type="date"
            className={inputCls}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Session time">
          <input className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Booking status">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="confirmed">confirmed</option>
            <option value="attended">attended</option>
            <option value="cancelled">cancelled</option>
            <option value="no_show">no_show</option>
          </select>
        </Field>
        <Field label="Payment status">
          <select
            className={inputCls}
            value={payStatus}
            onChange={(e) => setPayStatus(e.target.value)}
          >
            <option value="pay_at_class">pay_at_class</option>
            <option value="paid">paid</option>
            <option value="complimentary">complimentary</option>
            <option value="pending">pending</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function FranchiseeEditModal({
  record,
  busy,
  onClose,
  onSave,
  venueOptions,
}: {
  record: SiteRecord<FranchiseeData> | null;
  busy: boolean;
  onClose: () => void;
  onSave: (data: Partial<FranchiseeData>) => Promise<void>;
  venueOptions: VenueOption[];
}) {
  const [name, setName] = useState("");
  const [town, setTown] = useState("");
  const [territory, setTerritory] = useState("");
  const [phone, setPhone] = useState("");
  const [royalty, setRoyalty] = useState(10);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("active");
  const [schedule, setSchedule] = useState<FranchiseClassSlot[]>([]);

  useEffect(() => {
    if (!record) return;
    setName(record.data.full_name);
    setTown(record.data.town_city);
    setTerritory(record.data.territory);
    setPhone(record.data.phone || "");
    setRoyalty(Number(record.data.royalty_percent) || 10);
    setNotes(record.data.notes || "");
    setStatus(record.data.record_status || "active");
    setSchedule(parseJsonSafe<FranchiseClassSlot[]>(record.data.schedule_json || "[]", []));
  }, [record]);

  return (
    <Modal
      open={!!record}
      title="Edit franchisee"
      description={record?.data.email}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn-secondary !py-2 text-sm" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary !py-2 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              onSave({
                full_name: name,
                town_city: town,
                territory,
                phone,
                royalty_percent: Number(royalty),
                notes,
                record_status: status,
                schedule_json: JSON.stringify(schedule),
              })
            }
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Phone">
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Town / city">
          <input className={inputCls} value={town} onChange={(e) => setTown(e.target.value)} />
        </Field>
        <Field label="Territory">
          <input
            className={inputCls}
            value={territory}
            onChange={(e) => setTerritory(e.target.value)}
          />
        </Field>
        <Field label="Royalty %">
          <input
            type="number"
            className={inputCls}
            value={royalty}
            onChange={(e) => setRoyalty(Number(e.target.value))}
          />
        </Field>
        <Field label="Status">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="ended">ended</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea
              className={inputCls}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <ScheduleSlotsEditor slots={schedule} onChange={setSchedule} venues={venueOptions} />
        </div>
      </div>
    </Modal>
  );
}

function ChatChannelsAdmin({
  onChange,
  confirm,
  toast,
}: {
  onChange: (msg: string) => Promise<void>;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  toast: (m: string, k?: "ok" | "err") => void;
}) {
  const [channels, setChannels] = useState<
    {
      id: string;
      slug: string;
      title: string;
      description: string;
      kind: string;
      adminOnlyPost: boolean;
      sort_order: number;
      published: boolean;
      record_status: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    kind: "custom" as "announcements" | "general" | "custom",
    adminOnlyPost: false,
    sort_order: 50,
    published: true,
  });

  async function reload() {
    const { ensureDefaultChannels, listAllChannelsAdmin } = await import("@/lib/chat");
    await ensureDefaultChannels();
    const list = await listAllChannelsAdmin();
    setChannels(list);
  }

  useEffect(() => {
    reload()
      .catch((e) => toast(e instanceof Error ? e.message : String(e), "err"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditId(null);
    setForm({
      title: "",
      slug: "",
      description: "",
      kind: "custom",
      adminOnlyPost: false,
      sort_order: 50,
      published: true,
    });
    setOpen(true);
  }

  function openEdit(ch: (typeof channels)[0]) {
    setEditId(ch.id);
    setForm({
      title: ch.title,
      slug: ch.slug,
      description: ch.description,
      kind: (ch.kind as "announcements" | "general" | "custom") || "custom",
      adminOnlyPost: ch.adminOnlyPost,
      sort_order: ch.sort_order,
      published: ch.published,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title.trim()) {
      toast("Channel name is required", "err");
      return;
    }
    const slug =
      form.slug.trim() ||
      form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    setBusy(true);
    try {
      const payload = {
        content_type: "chat_channel" as const,
        slug,
        title: form.title.trim(),
        summary: form.description.trim(),
        body_json: JSON.stringify({
          kind: form.kind,
          admin_only_post: form.kind === "announcements" ? true : form.adminOnlyPost,
          description: form.description.trim(),
        }),
        image_url: "",
        published: form.published,
        sort_order: Number(form.sort_order) || 50,
        record_status: form.published ? "active" : "draft",
      };
      if (editId) {
        await updateRecord<CmsContentData>("cms_content", editId, payload);
        await onChange("Channel updated");
      } else {
        await createRecord<CmsContentData>("cms_content", payload);
        await onChange("Channel created");
      }
      setOpen(false);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-muted">Loading channels…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl tracking-wide">Community chat channels</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Subscriber-only chat in the dancer studio. Default channels:{" "}
            <strong className="text-cream">Announcements</strong> (admin posts only) and{" "}
            <strong className="text-cream">General chat</strong>. Create more channels anytime.
          </p>
        </div>
        <button type="button" className="btn-primary !py-2 text-sm" onClick={openCreate}>
          New channel
        </button>
      </div>

      <AdminTable
        headers={["Channel", "Slug", "Posting", "Status", "Actions"]}
        rows={channels.map((ch) => [
          <>
            {ch.title}
            <div className="text-xs text-muted">{ch.description || "—"}</div>
          </>,
          ch.slug,
          ch.adminOnlyPost ? "Admins only" : "All members",
          ch.published && ch.record_status === "active" ? "Live" : "Hidden",
          <div key={ch.id} className="flex flex-wrap gap-2">
            <button
              type="button"
              className="text-xs font-bold text-accent"
              onClick={() => openEdit(ch)}
            >
              Edit
            </button>
            <button
              type="button"
              className="text-xs font-bold text-muted"
              onClick={async () => {
                await updateRecord<CmsContentData>("cms_content", ch.id, {
                  published: !ch.published,
                  record_status: !ch.published ? "active" : "draft",
                });
                await onChange(ch.published ? "Channel hidden" : "Channel published");
                await reload();
              }}
            >
              {ch.published ? "Hide" : "Show"}
            </button>
            {ch.kind === "custom" && (
              <button
                type="button"
                className="text-xs font-bold text-red-400"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete channel?",
                    message: `Delete “${ch.title}”? Messages stay in the database but the channel disappears from chat.`,
                    confirmLabel: "Delete",
                    danger: true,
                  });
                  if (!ok) return;
                  await deleteRecord("cms_content", ch.id);
                  await onChange("Channel deleted");
                  await reload();
                }}
              >
                Delete
              </button>
            )}
          </div>,
        ])}
      />

      <Modal
        open={open}
        title={editId ? "Edit channel" : "New channel"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary !py-2 text-sm"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary !py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() => save()}
            >
              {busy ? "Saving…" : "Save channel"}
            </button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Name">
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Social events"
            />
          </Field>
          <Field label="Slug" hint="URL-safe id">
            <input
              className={inputCls}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="social-events"
            />
          </Field>
          <Field label="Description">
            <input
              className={inputCls}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Type">
            <select
              className={inputCls}
              value={form.kind}
              onChange={(e) => {
                const kind = e.target.value as typeof form.kind;
                setForm({
                  ...form,
                  kind,
                  adminOnlyPost: kind === "announcements" ? true : form.adminOnlyPost,
                });
              }}
            >
              <option value="custom">Custom channel</option>
              <option value="announcements">Announcements</option>
              <option value="general">General</option>
            </select>
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              className={inputCls}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.kind === "announcements" || form.adminOnlyPost}
              disabled={form.kind === "announcements"}
              onChange={(e) => setForm({ ...form, adminOnlyPost: e.target.checked })}
            />
            Only admins can post
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
            />
            Visible in member chat
          </label>
        </div>
      </Modal>
    </div>
  );
}

function GalleryAdmin({
  items,
  onChange,
  confirm,
  toast,
}: {
  items: SiteRecord<CmsContentData>[];
  onChange: (msg: string) => Promise<void>;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  toast: (m: string, k?: "ok" | "err") => void;
}) {
  const sorted = [...items].sort(
    (a, b) => a.data.sort_order - b.data.sort_order || a.data.title.localeCompare(b.data.title)
  );
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SiteRecord<CmsContentData> | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    alt: "",
    image: "",
    sort_order: 10,
    published: true,
  });

  function openCreate() {
    setEdit(null);
    setForm({
      alt: `Boots N Boogie moment ${sorted.length + 1}`,
      image: "",
      sort_order: (sorted[sorted.length - 1]?.data.sort_order ?? 0) + 10,
      published: true,
    });
    setOpen(true);
  }

  function openEdit(item: SiteRecord<CmsContentData>) {
    setEdit(item);
    setForm({
      alt: item.data.title,
      image: item.data.image_url || "",
      sort_order: item.data.sort_order ?? 0,
      published: !!item.data.published,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.image.trim()) {
      toast("Add an image (upload or paste a URL)", "err");
      return;
    }
    if (!form.alt.trim()) {
      toast("Add a short description (alt text)", "err");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        content_type: "gallery" as const,
        slug: edit?.data.slug || `gallery-${Date.now()}`,
        title: form.alt.trim(),
        summary: "On the floor gallery",
        body_json: JSON.stringify({ section: "on_the_floor" }),
        image_url: form.image,
        published: form.published,
        sort_order: Number(form.sort_order) || 0,
        record_status: form.published ? "active" : "draft",
      };
      if (edit) {
        await updateRecord<CmsContentData>("cms_content", edit.id, payload);
        await onChange("Gallery image updated");
      } else {
        await createRecord<CmsContentData>("cms_content", payload);
        await onChange("Gallery image added");
      }
      setOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function seedDefaults() {
    let added = 0;
    for (let i = 0; i < GALLERY.length; i++) {
      const src = GALLERY[i];
      if (items.some((it) => it.data.image_url === src)) continue;
      await createRecord<CmsContentData>("cms_content", {
        content_type: "gallery",
        slug: `gallery-default-${i + 1}`,
        title: `Boots N Boogie moment ${i + 1}`,
        summary: "On the floor gallery",
        body_json: JSON.stringify({ section: "on_the_floor" }),
        image_url: src,
        published: true,
        sort_order: (i + 1) * 10,
        record_status: "active",
      });
      added++;
    }
    await onChange(
      added ? `Seeded ${added} default gallery image(s)` : "Default gallery images already present"
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl tracking-wide">On the floor gallery</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            These photos appear on the homepage and About page. Click an image on the public site
            to expand it. Upload photos or paste image URLs. Keep uploads compressed (automatic).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary !py-2 text-sm" onClick={() => seedDefaults()}>
            Seed defaults
          </button>
          <button type="button" className="btn-primary !py-2 text-sm" onClick={openCreate}>
            Add image
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="card-surface p-6 text-sm text-muted">
          No CMS gallery images yet — the public site shows built-in defaults until you add or seed
          images here.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((item) => (
            <div key={item.id} className="card-surface overflow-hidden">
              <div className="relative aspect-[4/3] bg-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.data.image_url}
                  alt={item.data.title}
                  className="h-full w-full object-cover"
                />
                {!item.data.published && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                    Hidden
                  </span>
                )}
              </div>
              <div className="space-y-2 p-4">
                <p className="text-sm font-semibold text-cream">{item.data.title}</p>
                <p className="text-xs text-muted">Sort: {item.data.sort_order}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs font-bold text-accent"
                    onClick={() => openEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs font-bold text-muted"
                    onClick={async () => {
                      await updateRecord<CmsContentData>("cms_content", item.id, {
                        published: !item.data.published,
                        record_status: !item.data.published ? "active" : "draft",
                      });
                      await onChange(
                        item.data.published ? "Image hidden from site" : "Image published"
                      );
                    }}
                  >
                    {item.data.published ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    className="text-xs font-bold text-red-400"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Delete gallery image?",
                        message: `Remove “${item.data.title}” from On the floor?`,
                        confirmLabel: "Delete",
                        danger: true,
                      });
                      if (!ok) return;
                      await deleteRecord("cms_content", item.id);
                      await onChange("Gallery image deleted");
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title={edit ? "Edit gallery image" : "Add gallery image"}
        description="Homepage & About — On the floor"
        onClose={() => setOpen(false)}
        wide
        footer={
          <>
            <button
              type="button"
              className="btn-secondary !py-2 text-sm"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary !py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() => save()}
            >
              {busy ? "Saving…" : "Save image"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <ImageUploadField
            label="Photo"
            value={form.image}
            onChange={(image) => setForm({ ...form, image })}
          />
          <Field label="Caption / alt text">
            <input
              className={inputCls}
              value={form.alt}
              onChange={(e) => setForm({ ...form, alt: e.target.value })}
              placeholder="e.g. Summer social at Arnold House"
            />
          </Field>
          <Field label="Sort order" hint="Lower numbers appear first">
            <input
              type="number"
              className={inputCls}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
            />
            Show on public site
          </label>
        </div>
      </Modal>
    </div>
  );
}

function HqTownsAdmin({
  items,
  venueOptions,
  onChange,
  confirm,
  toast,
}: {
  items: SiteRecord<CmsContentData>[];
  venueOptions: VenueOption[];
  onChange: (msg: string) => Promise<void>;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  toast: (m: string, k?: "ok" | "err") => void;
}) {
  const [edit, setEdit] = useState<SiteRecord<CmsContentData> | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    town: "",
    region: "",
    blurb: "",
    slug: "",
    published: true,
    status: "active",
    schedule: [] as FranchiseClassSlot[],
  });

  function openCreate() {
    setCreating(true);
    setEdit(null);
    setForm({
      town: "",
      region: "",
      blurb: "Company-run Boots N Boogie classes in this town.",
      slug: "",
      published: true,
      status: "active",
      schedule: [
        emptyClassSlot({
          venueName: venueOptions[0]?.name || SITE.venue,
          venueAddress: venueOptions[0]?.address || SITE.addressShort,
        }),
      ],
    });
  }

  function openEdit(item: SiteRecord<CmsContentData>) {
    const body = parseJsonSafe<HqLocationBody>(item.data.body_json, {
      region: "",
      blurb: "",
      schedule: [],
    });
    setEdit(item);
    setCreating(false);
    setForm({
      town: item.data.title,
      region: body.region || item.data.summary || "",
      blurb: body.blurb || "",
      slug: item.data.slug,
      published: !!item.data.published,
      status: item.data.record_status || "active",
      schedule: body.schedule || [],
    });
  }

  function closeForm() {
    setEdit(null);
    setCreating(false);
  }

  async function save() {
    if (!form.town.trim()) {
      toast("Town / city name is required", "err");
      return;
    }
    const slug =
      form.slug.trim() ||
      form.town
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") ||
      `town-${Date.now()}`;
    const body: HqLocationBody = {
      region: form.region.trim(),
      blurb: form.blurb.trim(),
      schedule: form.schedule,
    };
    const payload = {
      content_type: "hq_location" as const,
      slug,
      title: form.town.trim(),
      summary: form.region.trim() || "HQ location",
      body_json: JSON.stringify(body),
      image_url: form.schedule[0]?.image || "/images/class-beginner.jpg",
      published: form.published,
      sort_order: 40,
      record_status: form.status,
    };
    setBusy(true);
    try {
      if (edit) {
        await updateRecord<CmsContentData>("cms_content", edit.id, payload);
        await onChange(`HQ town “${form.town.trim()}” updated`);
      } else {
        await createRecord<CmsContentData>("cms_content", payload);
        await onChange(`HQ town “${form.town.trim()}” created`);
      }
      closeForm();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  const activeCount = items.filter(
    (i) => i.data.record_status === "active" && i.data.published
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl tracking-wide">HQ towns (company-run)</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Add towns where <strong className="text-cream">your team</strong> runs classes — not
            franchisees. These appear on /classes next to Rugby HQ. Franchise towns are managed under
            Franchise.
          </p>
          <p className="mt-1 text-xs text-muted">{activeCount} live on the public site</p>
        </div>
        <button type="button" className="btn-primary !py-2 text-sm" onClick={openCreate}>
          Add HQ town
        </button>
      </div>

      <AdminTable
        headers={["Town", "Region", "Classes/week", "Status", "Actions"]}
        rows={items.map((item) => {
          const body = parseJsonSafe<HqLocationBody>(item.data.body_json, {
            schedule: [],
          });
          const live =
            item.data.record_status === "active" && item.data.published ? "Live" : "Hidden";
          return [
            item.data.title,
            body.region || item.data.summary || "—",
            String(body.schedule?.length || 0),
            live,
            <div key={item.id} className="flex flex-wrap gap-2">
              <button
                type="button"
                className="text-xs font-bold text-accent"
                onClick={() => openEdit(item)}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-xs font-bold text-muted"
                onClick={async () => {
                  const nextPub = !item.data.published;
                  await updateRecord<CmsContentData>("cms_content", item.id, {
                    published: nextPub,
                    record_status: nextPub ? "active" : "draft",
                  });
                  await onChange(nextPub ? "HQ town published" : "HQ town unpublished");
                }}
              >
                {item.data.published ? "Unpublish" : "Publish"}
              </button>
              <button
                type="button"
                className="text-xs font-bold text-red-400"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Delete HQ town?",
                    message: `Remove “${item.data.title}” from the site? This does not delete past bookings.`,
                    confirmLabel: "Delete",
                    danger: true,
                  });
                  if (!ok) return;
                  await deleteRecord("cms_content", item.id);
                  await onChange("HQ town deleted");
                }}
              >
                Delete
              </button>
            </div>,
          ];
        })}
      />

      <Modal
        open={creating || !!edit}
        title={edit ? "Edit HQ town" : "Add HQ town"}
        description="Company-run location — not a franchise"
        onClose={closeForm}
        wide
        footer={
          <>
            <button
              type="button"
              className="btn-secondary !py-2 text-sm"
              disabled={busy}
              onClick={closeForm}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary !py-2 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() => save()}
            >
              {busy ? "Saving…" : "Save town"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Town / city" hint="Shown in the /classes dropdown">
              <input
                className={inputCls}
                value={form.town}
                onChange={(e) => setForm({ ...form, town: e.target.value })}
                placeholder="e.g. Coventry"
              />
            </Field>
            <Field label="Region / county">
              <input
                className={inputCls}
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="e.g. West Midlands"
              />
            </Field>
            <Field label="URL slug" hint="Optional — auto from town name">
              <input
                className={inputCls}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="coventry"
              />
            </Field>
            <Field label="Status">
              <select
                className={inputCls}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">active</option>
                <option value="draft">draft</option>
                <option value="archived">archived</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Short description">
                <textarea
                  className={inputCls}
                  rows={2}
                  value={form.blurb}
                  onChange={(e) => setForm({ ...form, blurb: e.target.value })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              Show on public /classes page
            </label>
          </div>
          <ScheduleSlotsEditor
            slots={form.schedule}
            onChange={(schedule) => setForm({ ...form, schedule })}
            venues={venueOptions}
          />
        </div>
      </Modal>
    </div>
  );
}
