"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Send, Users } from "lucide-react";
import {
  Field,
  inputCls,
  type ToastKind,
} from "@/components/admin/AdminChrome";
import {
  RichEmailEditor,
  type EmailAttachmentDraft,
} from "@/components/admin/RichEmailEditor";
import {
  recipientsForTarget,
  wrapEmailHtml,
  type MailingListTarget,
} from "@/lib/mailing";
import {
  loadPaymentSettings,
  sendResendEmail,
  type EmailAttachment,
} from "@/lib/payments";
import { SITE } from "@/lib/data";
import {
  createRecord,
  listRecords,
  type MemberData,
  type SiteRecord,
} from "@/lib/sitedata";
import type { CmsContentData } from "@/lib/cms-types";

type Props = {
  members: SiteRecord<MemberData>[];
  flash: (msg: string) => Promise<void> | void;
  toast: (msg: string, kind?: ToastKind) => void;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
};

export function MailingAdmin({ members, flash, toast, confirm }: Props) {
  const [target, setTarget] = useState<MailingListTarget>("general");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [bodyHtml, setBodyHtml] = useState(
    "<p>Hi dancers,</p><p>Write your message here…</p>"
  );
  const [attachments, setAttachments] = useState<EmailAttachmentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<SiteRecord<CmsContentData>[]>([]);

  const recipients = useMemo(
    () => recipientsForTarget(members, target),
    [members, target]
  );

  const generalCount = useMemo(
    () => recipientsForTarget(members, "general").length,
    [members]
  );
  const subscriberCount = useMemo(
    () => recipientsForTarget(members, "subscribers").length,
    [members]
  );

  async function loadHistory() {
    try {
      const rows = await listRecords<CmsContentData>("cms_content", 200);
      setHistory(
        rows
          .filter((r) => r.data.content_type === "email_campaign")
          .sort((a, b) =>
            (b.created_at || b.createdAt || "").localeCompare(
              a.created_at || a.createdAt || ""
            )
          )
          .slice(0, 20)
      );
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    loadHistory().catch(() => undefined);
  }, []);

  async function onSend() {
    if (!subject.trim()) {
      toast("Add a subject line", "err");
      return;
    }
    if (!bodyHtml.trim() || bodyHtml === "<p><br></p>") {
      toast("Write some email content", "err");
      return;
    }
    if (!recipients.length) {
      toast("No recipients on this list", "err");
      return;
    }

    const ok = await confirm({
      title: "Send campaign?",
      message: `Send “${subject.trim()}” to ${recipients.length} recipient(s) on the ${
        target === "general"
          ? "general mailing list"
          : target === "subscribers"
            ? "subscriber list"
            : "combined lists"
      }? Each person gets their own email (no shared To:).`,
      confirmLabel: "Send emails",
    });
    if (!ok) return;

    setBusy(true);
    try {
      const settings = await loadPaymentSettings();
      const from =
        settings.resendFromEmail ||
        `Boots N Boogie <hello@${SITE.email.split("@")[1] || "bootsnboogie.local"}>`;
      const html = wrapEmailHtml(bodyHtml, { preheader: preheader.trim() || undefined });
      const atts: EmailAttachment[] = attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }));

      const result = await sendResendEmail({
        apiKey: settings.resendApiKey,
        from,
        to: recipients.map((r) => r.email),
        subject: subject.trim(),
        html,
        attachments: atts.length ? atts : undefined,
        individual: true,
      });

      if (!result.ok) {
        throw new Error(result.error || "Send failed");
      }

      await createRecord<CmsContentData>("cms_content", {
        content_type: "email_campaign",
        slug: `campaign-${Date.now()}`,
        title: subject.trim(),
        summary: `${target} · ${result.sent ?? recipients.length} sent`,
        body_json: JSON.stringify({
          target,
          subject: subject.trim(),
          preheader,
          recipient_count: result.sent ?? recipients.length,
          emails: recipients.map((r) => r.email),
          sent_at: new Date().toISOString(),
        }),
        image_url: "",
        published: true,
        sort_order: 0,
        record_status: "sent",
      });

      await flash(
        `Campaign sent to ${result.sent ?? recipients.length} recipient(s).`
      );
      await loadHistory();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Send failed", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-surface p-5">
          <p className="text-sm text-muted">General list (opt-in)</p>
          <p className="mt-2 font-display text-3xl text-accent">{generalCount}</p>
        </div>
        <div className="card-surface p-5">
          <p className="text-sm text-muted">Subscriber list (auto)</p>
          <p className="mt-2 font-display text-3xl text-accent">{subscriberCount}</p>
        </div>
        <div className="card-surface p-5">
          <p className="text-sm text-muted">Selected audience</p>
          <p className="mt-2 font-display text-3xl text-cream">{recipients.length}</p>
        </div>
      </div>

      <div className="card-surface space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Mail className="text-accent" size={22} />
          <h2 className="font-display text-2xl tracking-wide">Compose campaign</h2>
        </div>
        <p className="text-sm text-muted">
          Full design tools: bold, italic, underline, headings, fonts, sizes, colours, lists,
          links, images, video embeds, raw HTML, Markdown, and file attachments. Subscriber list
          is automatic for active members; general list is opt-in at sign-up.
        </p>

        <Field label="Audience">
          <select
            className={inputCls}
            value={target}
            onChange={(e) => setTarget(e.target.value as MailingListTarget)}
          >
            <option value="general">
              General mailing list only ({generalCount})
            </option>
            <option value="subscribers">
              Subscriber list only ({subscriberCount})
            </option>
            <option value="both">Both lists combined (deduped)</option>
          </select>
        </Field>

        <Field label="Subject">
          <input
            className={inputCls}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Summer social tickets now open"
          />
        </Field>

        <Field label="Preview text (optional inbox snippet)">
          <input
            className={inputCls}
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            placeholder="Short line shown in some inboxes"
          />
        </Field>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Email body
          </p>
          <RichEmailEditor
            html={bodyHtml}
            onChange={setBodyHtml}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
        </div>

        <div className="rounded-xl border border-line bg-bg/50 p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <Users size={12} /> Recipients preview ({recipients.length})
          </p>
          <div className="max-h-36 overflow-y-auto text-xs text-muted">
            {recipients.length === 0 && <p>No one on this list yet.</p>}
            {recipients.slice(0, 40).map((r) => (
              <div key={r.id}>
                {r.name ? `${r.name} · ` : ""}
                {r.email}
              </div>
            ))}
            {recipients.length > 40 && (
              <p className="mt-1 text-cream">…and {recipients.length - 40} more</p>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={busy || !recipients.length}
          onClick={onSend}
          className="btn-primary disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" size={18} /> Sending…
            </>
          ) : (
            <>
              <Send size={18} /> Send to {recipients.length} people
            </>
          )}
        </button>
      </div>

      <div>
        <h3 className="font-display text-xl tracking-wide">Recent campaigns</h3>
        <div className="mt-3 space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted">No campaigns sent yet.</p>
          )}
          {history.map((h) => (
            <div key={h.id} className="card-surface p-4 text-sm">
              <p className="font-semibold text-cream">{h.data.title}</p>
              <p className="text-xs text-muted">
                {h.data.summary}
                {h.created_at || h.createdAt
                  ? ` · ${new Date(h.created_at || h.createdAt || "").toLocaleString("en-GB")}`
                  : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
