import { SITE, SUBSCRIPTION_PLAN } from "@/lib/data";
import { hasMembershipBenefits } from "@/lib/membership";
import { loadPaymentSettings, sendResendEmail } from "@/lib/payments";
import {
  createRecord,
  listRecords,
  updateRecord,
  type ChatMessageData,
  type MemberData,
  type SiteRecord,
} from "@/lib/sitedata";
import type { CmsContentData } from "@/lib/cms-types";
import { parseJsonSafe } from "@/lib/cms-types";

export type ChatChannelKind = "announcements" | "general" | "custom";

export type ChatChannelBody = {
  kind: ChatChannelKind;
  /** If true, only admins may post */
  admin_only_post?: boolean;
  description?: string;
};

export type ChatChannel = {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: ChatChannelKind;
  adminOnlyPost: boolean;
  sort_order: number;
  published: boolean;
  record_status: string;
};

const DEFAULT_CHANNELS: {
  slug: string;
  title: string;
  kind: ChatChannelKind;
  admin_only_post: boolean;
  description: string;
  sort_order: number;
}[] = [
  {
    slug: "announcements",
    title: "Announcements",
    kind: "announcements",
    admin_only_post: true,
    description: "Studio news from the Boots N Boogie team",
    sort_order: 1,
  },
  {
    slug: "general",
    title: "General chat",
    kind: "general",
    admin_only_post: false,
    description: "Say hello and chat with fellow members",
    sort_order: 2,
  },
];

export function parseChannel(row: SiteRecord<CmsContentData>): ChatChannel {
  const body = parseJsonSafe<ChatChannelBody>(row.data.body_json, {
    kind: "custom",
    admin_only_post: false,
  });
  const kind = body.kind || "custom";
  return {
    id: row.id,
    slug: row.data.slug,
    title: row.data.title,
    description: body.description || row.data.summary || "",
    kind,
    adminOnlyPost: body.admin_only_post ?? kind === "announcements",
    sort_order: row.data.sort_order ?? 100,
    published: !!row.data.published,
    record_status: row.data.record_status,
  };
}

/** Ensure default announcements + general channels exist */
export async function ensureDefaultChannels(): Promise<ChatChannel[]> {
  const rows = await listRecords<CmsContentData>("cms_content", 200);
  const existing = rows.filter((r) => r.data.content_type === "chat_channel");
  for (const def of DEFAULT_CHANNELS) {
    const bySlug = existing.some((r) => r.data.slug === def.slug);
    if (bySlug) continue;
    await createRecord<CmsContentData>("cms_content", {
      content_type: "chat_channel",
      slug: def.slug,
      title: def.title,
      summary: def.description,
      body_json: JSON.stringify({
        kind: def.kind,
        admin_only_post: def.admin_only_post,
        description: def.description,
      } satisfies ChatChannelBody),
      image_url: "",
      published: true,
      sort_order: def.sort_order,
      record_status: "active",
    });
  }
  return listChannels();
}

export async function listChannels(): Promise<ChatChannel[]> {
  const rows = await listRecords<CmsContentData>("cms_content", 200);
  return rows
    .filter(
      (r) =>
        r.data.content_type === "chat_channel" &&
        r.data.record_status !== "archived" &&
        r.data.published
    )
    .map(parseChannel)
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
}

export async function listAllChannelsAdmin(): Promise<ChatChannel[]> {
  const rows = await listRecords<CmsContentData>("cms_content", 200);
  return rows
    .filter((r) => r.data.content_type === "chat_channel")
    .map(parseChannel)
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
}

export async function listChannelMessages(
  channelId: string,
  limit = 80
): Promise<SiteRecord<ChatMessageData>[]> {
  const all = await listRecords<ChatMessageData>("chat_messages", 500);
  return all
    .filter(
      (m) =>
        m.data.channel_id === channelId &&
        m.data.record_status !== "deleted" &&
        m.data.record_status !== "archived"
    )
    .sort((a, b) => {
      const ta = a.created_at || a.createdAt || "";
      const tb = b.created_at || b.createdAt || "";
      return ta.localeCompare(tb);
    })
    .slice(-limit);
}

function isAnnouncementChannel(channel: ChatChannel): boolean {
  return channel.kind === "announcements" || channel.adminOnlyPost === true;
}

/** Email everyone opted into announcement emails (joined chat + active membership). */
async function emailAnnouncementSubscribers(opts: {
  channel: ChatChannel;
  body: string;
  authorName: string;
  authorId: string;
}): Promise<void> {
  if (!isAnnouncementChannel(opts.channel)) return;

  try {
    const members = await listRecords<MemberData>("members", 400);
    const recipients = members
      .filter((m) => {
        if (m.id === opts.authorId) return false;
        if (!m.data.chat_email_announcements) return false;
        // Admins always eligible if opted in; members need active benefits + joined chat
        if (m.data.role === "admin") return true;
        if (!m.data.chat_joined) return false;
        return hasMembershipBenefits(m.data.subscription_status, m.data.period_end);
      })
      .map((m) => (m.data.email || "").trim().toLowerCase())
      .filter((e) => e.includes("@"));

    if (!recipients.length) return;

    const settings = await loadPaymentSettings();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const preview =
      opts.body.length > 400 ? `${opts.body.slice(0, 400)}…` : opts.body;
    const safePreview = preview
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

    await sendResendEmail({
      apiKey: settings.resendApiKey,
      from: settings.resendFromEmail || `Boots N Boogie <${SITE.email}>`,
      to: recipients,
      subject: `${SITE.name} · ${opts.channel.title}: ${opts.authorName}`,
      html: `
        <p style="font-family:Arial,sans-serif;color:#333">
          New announcement in <strong>${opts.channel.title}</strong>
        </p>
        <p style="font-family:Arial,sans-serif;color:#666;font-size:13px">
          From ${opts.authorName}
        </p>
        <div style="font-family:Georgia,serif;font-size:16px;line-height:1.55;color:#1a1208;background:#faf6f0;border-left:4px solid #e8a017;padding:16px 18px;margin:16px 0;border-radius:0 8px 8px 0">
          ${safePreview}
        </div>
        <p style="margin:20px 0">
          <a href="${origin}/community/" style="background:#e8a017;color:#1a1208;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">
            Open community chat
          </a>
        </p>
        <p style="font-family:Arial,sans-serif;font-size:12px;color:#888">
          You’re receiving this because you turned on announcement emails in Community settings.
          You can turn them off anytime in chat settings.
        </p>
      `,
      individual: true,
    });
  } catch {
    /* posting should still succeed if email fails */
  }
}

export async function postChatMessage(input: {
  channel: ChatChannel;
  memberId: string;
  memberEmail: string;
  memberName: string;
  memberRole: string;
  body: string;
}): Promise<SiteRecord<ChatMessageData>> {
  const text = input.body.trim();
  if (!text) throw new Error("Message cannot be empty");
  if (text.length > 2000) throw new Error("Message is too long (max 2000 characters)");
  if (input.channel.adminOnlyPost && input.memberRole !== "admin") {
    throw new Error("Only studio admins can post in this channel");
  }
  const rec = await createRecord<ChatMessageData>("chat_messages", {
    channel_id: input.channel.id,
    channel_slug: input.channel.slug,
    member_id: input.memberId,
    member_email: input.memberEmail,
    member_name: input.memberName,
    member_role: input.memberRole,
    body: text,
    record_status: "active",
  });

  // Fire-and-forget announcement emails for opted-in members
  void emailAnnouncementSubscribers({
    channel: input.channel,
    body: text,
    authorName: input.memberName,
    authorId: input.memberId,
  });

  return rec;
}

export function canAccessChat(opts: {
  role?: string;
  subscription_status?: string | null;
  period_end?: string | null;
  chat_joined?: boolean;
}): { allowed: boolean; reason: "ok" | "not_member" | "not_joined" | "admin" } {
  if (opts.role === "admin") return { allowed: true, reason: "admin" };
  if (!hasMembershipBenefits(opts.subscription_status, opts.period_end)) {
    return { allowed: false, reason: "not_member" };
  }
  if (!opts.chat_joined) return { allowed: false, reason: "not_joined" };
  return { allowed: true, reason: "ok" };
}

/**
 * If member opted in but no longer has benefits, silently leave chat and email once.
 */
export async function enforceChatMembership(member: {
  id: string;
  email: string;
  name: string;
  role: string;
  subscription_status?: string | null;
  period_end?: string | null;
  chat_joined?: boolean;
  chat_revoked_notified?: boolean;
}): Promise<{ revoked: boolean }> {
  if (member.role === "admin") return { revoked: false };
  if (!member.chat_joined) return { revoked: false };
  if (hasMembershipBenefits(member.subscription_status, member.period_end)) {
    return { revoked: false };
  }

  await updateRecord<MemberData>("members", member.id, {
    chat_joined: false,
  });

  if (!member.chat_revoked_notified) {
    const settings = await loadPaymentSettings();
    await sendResendEmail({
      apiKey: settings.resendApiKey,
      from: settings.resendFromEmail || `Boots N Boogie <${SITE.email}>`,
      to: [member.email],
      subject: `${SITE.name} community chat access paused`,
      html: `
        <p>Hi ${member.name || "there"},</p>
        <p>Your ${SITE.name} membership is no longer active, so access to the <strong>subscriber community chat</strong> has been removed.</p>
        <p>You can rejoin the community any time by resuming your membership (£${SUBSCRIPTION_PLAN.amountGbp}/month) and opting back in from your dancer studio.</p>
        <p><a href="${typeof window !== "undefined" ? window.location.origin : ""}/subscribe/">View membership options</a></p>
        <p>— ${SITE.name}</p>
      `,
    });
    await updateRecord<MemberData>("members", member.id, {
      chat_revoked_notified: true,
    });
  }

  return { revoked: true };
}

export async function joinChat(memberId: string): Promise<void> {
  await updateRecord<MemberData>("members", memberId, {
    chat_joined: true,
    chat_revoked_notified: false,
  });
}

export async function leaveChat(memberId: string): Promise<void> {
  await updateRecord<MemberData>("members", memberId, {
    chat_joined: false,
  });
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  await updateRecord<ChatMessageData>("chat_messages", messageId, {
    record_status: "deleted",
  });
}

export async function updateChatNotifyPrefs(
  memberId: string,
  prefs: {
    chat_notify_messages?: boolean;
    chat_notify_announcements?: boolean;
    chat_email_announcements?: boolean;
  }
): Promise<void> {
  await updateRecord<MemberData>("members", memberId, prefs);
}
