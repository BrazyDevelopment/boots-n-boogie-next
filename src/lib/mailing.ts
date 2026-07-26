/** Mailing list helpers */

import { hasMembershipBenefits } from "@/lib/membership";
import type { MemberData, SiteRecord } from "@/lib/sitedata";

export type MailingListTarget = "general" | "subscribers" | "both";

export function isOnGeneralList(m: SiteRecord<MemberData>): boolean {
  return m.data.mailing_list_opt_in === true;
}

/** Automatic subscriber list — active membership or still in paid cancel period */
export function isOnSubscriberList(m: SiteRecord<MemberData>): boolean {
  if (m.data.role === "admin") return true;
  return hasMembershipBenefits(m.data.subscription_status, m.data.period_end);
}

export function recipientsForTarget(
  members: SiteRecord<MemberData>[],
  target: MailingListTarget
): { email: string; name: string; id: string }[] {
  const out: { email: string; name: string; id: string }[] = [];
  const seen = new Set<string>();

  for (const m of members) {
    const email = (m.data.email || "").trim().toLowerCase();
    if (!email.includes("@")) continue;

    const general = isOnGeneralList(m);
    const sub = isOnSubscriberList(m);
    let include = false;
    if (target === "general") include = general;
    else if (target === "subscribers") include = sub;
    else include = general || sub;

    if (!include) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: m.data.name || "", id: m.id });
  }

  return out.sort((a, b) => a.email.localeCompare(b.email));
}

/** Very small markdown → HTML for the Markdown tab */
export function markdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // fenced code
  html = html.replace(/```([\s\S]*?)```/g, (_m, code) => `<pre><code>${code.trim()}</code></pre>`);
  // headings
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // bold / italic / underline-ish
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/__(.+?)__/g, "<u>$1</u>");
  // links images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // lists
  html = html.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`);
  // paragraphs
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      if (/^<(h\d|ul|ol|pre|blockquote|img|div)/i.test(block.trim())) return block;
      return `<p>${block.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}

export function wrapEmailHtml(bodyHtml: string, opts?: { preheader?: string }): string {
  const pre = opts?.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>`
    : "";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Boots N Boogie</title>
</head>
<body style="margin:0;padding:0;background:#0c0907;color:#faf6f0;font-family:Georgia,'Times New Roman',serif;">
  ${pre}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0c0907;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:640px;background:#1c1510;border:1px solid rgba(243,230,208,0.12);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;background:linear-gradient(90deg,#e8a017,#c45c26);color:#1a1208;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:18px;letter-spacing:0.04em;">
              BOOTS N BOOGIE
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;font-size:16px;line-height:1.65;color:#faf6f0;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#b5a898;border-top:1px solid rgba(243,230,208,0.1);">
              You’re receiving this because you opted into Boots N Boogie emails or hold an active membership.
              Manage preferences in your dancer studio account.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
