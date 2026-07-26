"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { hashPassword, randomSaltHex, randomToken, sha256Hex } from "@/lib/auth-crypto";
import { SEED_ADMIN, SITE } from "@/lib/data";
import {
  loadPaymentSettings,
  sendResendEmail,
} from "@/lib/payments";
import {
  createRecord,
  listRecords,
  updateRecord,
  type MemberData,
  type SiteRecord,
} from "@/lib/sitedata";
import type { CmsContentData } from "@/lib/cms-types";
import { parseJsonSafe } from "@/lib/cms-types";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "dancer" | "admin";
  phone?: string;
  subscription_status: string;
  subscription_id?: string;
  period_end?: string;
  chat_joined?: boolean;
  chat_revoked_notified?: boolean;
  chat_notify_messages?: boolean;
  chat_notify_announcements?: boolean;
  /** Profile photo URL / compressed data URL */
  avatar_url?: string;
  /** General mailing list opt-in */
  mailing_list_opt_in?: boolean;
};

type MagicTokenBody = {
  token_hash: string;
  email: string;
  name?: string;
  phone?: string;
  /** Signup-time mailing list preference (applied when account is created) */
  mailing_list_opt_in?: boolean;
  expires_at: string;
  used?: boolean;
};

type AuthCtx = {
  user: SessionUser | null;
  loading: boolean;
  siteDataReady: boolean;
  siteDataError: string | null;
  /** Passwordless: email a one-time sign-in link */
  requestMagicLink: (
    email: string,
    opts?: { name?: string; phone?: string; mailing_list_opt_in?: boolean }
  ) => Promise<void>;
  /** Complete sign-in from link token */
  consumeMagicLink: (token: string, emailHint?: string) => Promise<void>;
  /**
   * Bootstrap only: seed admin password so you can open Admin → Payments
   * and turn on Resend before magic links work for everyone.
   */
  emergencyAdminLogin: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (patch: Partial<MemberData>) => Promise<void>;
};

const SESSION_KEY = "bnb_session_v1";
const AuthContext = createContext<AuthCtx | null>(null);
const MAGIC_TTL_MS = 20 * 60 * 1000; // 20 minutes

function toSession(rec: SiteRecord<MemberData>): SessionUser {
  return {
    id: rec.id,
    email: rec.data.email,
    name: rec.data.name,
    role: rec.data.role === "admin" ? "admin" : "dancer",
    phone: rec.data.phone,
    subscription_status: rec.data.subscription_status || "none",
    subscription_id: rec.data.subscription_id,
    period_end: rec.data.period_end,
    chat_joined: !!rec.data.chat_joined,
    chat_revoked_notified: !!rec.data.chat_revoked_notified,
    // default true when undefined so new members get notifies after opting in
    chat_notify_messages: rec.data.chat_notify_messages !== false,
    chat_notify_announcements: rec.data.chat_notify_announcements !== false,
    avatar_url: rec.data.avatar_url || undefined,
    mailing_list_opt_in: !!rec.data.mailing_list_opt_in,
  };
}

async function createMemberRecord(input: {
  email: string;
  name: string;
  phone?: string;
  role?: string;
  mailing_list_opt_in?: boolean;
}): Promise<SiteRecord<MemberData>> {
  const salt = randomSaltHex();
  // Unusable random password — accounts are passwordless
  const password_hash = await hashPassword(randomToken(24), salt);
  return createRecord<MemberData>("members", {
    email: input.email.toLowerCase(),
    name: input.name.trim() || "Dancer",
    password_hash,
    password_salt: salt,
    role: input.role || "dancer",
    phone: input.phone?.trim() || "",
    subscription_status: "none",
    mailing_list_opt_in: !!input.mailing_list_opt_in,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteDataReady, setSiteDataReady] = useState(false);
  const [siteDataError, setSiteDataError] = useState<string | null>(null);

  const ensureSeedAdmin = useCallback(async () => {
    try {
      const members = await listRecords<MemberData>("members", 200);
      setSiteDataReady(true);
      setSiteDataError(null);
      const hasAdmin = members.some((m) => m.data.role === "admin");
      if (!hasAdmin) {
        await createMemberRecord({
          email: SEED_ADMIN.email.toLowerCase(),
          name: SEED_ADMIN.name,
          role: "admin",
        });
      }
      return members;
    } catch (e) {
      setSiteDataReady(false);
      setSiteDataError(
        e instanceof Error
          ? e.message
          : "Site Data unavailable. Deploy to here.now with .herenow/data.json for live accounts."
      );
      return [] as SiteRecord<MemberData>[];
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      setUser(null);
      return;
    }
    try {
      const { id } = JSON.parse(raw) as { id: string };
      const members = await listRecords<MemberData>("members", 200);
      const rec = members.find((m) => m.id === id);
      if (!rec) {
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
        return;
      }
      setUser(toSession(rec));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await ensureSeedAdmin();
      await refreshUser();
      setLoading(false);
    })();
  }, [ensureSeedAdmin, refreshUser]);

  const requestMagicLink = useCallback(
    async (
      emailRaw: string,
      opts?: { name?: string; phone?: string; mailing_list_opt_in?: boolean }
    ) => {
      const email = emailRaw.trim().toLowerCase();
      if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");

      const members = await listRecords<MemberData>("members", 200);
      const existing = members.find((m) => m.data.email.toLowerCase() === email);
      const name = (opts?.name || existing?.data.name || "").trim();
      if (!existing && !name) {
        throw new Error("First time here? Enter your name so we can create your dancer account.");
      }

      const settings = await loadPaymentSettings();
      if (!settings.resendEnabled && !settings.resendApiKey) {
        // still try proxy-only path if RESEND_API_KEY is on here.now
      }

      const token = randomToken(32);
      const token_hash = await sha256Hex(token);
      const expires_at = new Date(Date.now() + MAGIC_TTL_MS).toISOString();

      // New sign-ups use the checkbox; existing accounts keep current preference unless checkbox was shown as update
      const mailingOpt =
        typeof opts?.mailing_list_opt_in === "boolean"
          ? opts.mailing_list_opt_in
          : !!existing?.data.mailing_list_opt_in;

      await createRecord<CmsContentData>("cms_content", {
        content_type: "auth_token",
        slug: `ml-${Date.now().toString(36)}-${token.slice(0, 8)}`,
        title: email,
        summary: "magic_link",
        body_json: JSON.stringify({
          token_hash,
          email,
          name: name || existing?.data.name || "",
          phone: opts?.phone?.trim() || existing?.data.phone || "",
          mailing_list_opt_in: mailingOpt,
          expires_at,
          used: false,
        } satisfies MagicTokenBody),
        image_url: "",
        published: false,
        sort_order: 0,
        record_status: "active",
      });

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const next = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") || "/account/"
        : "/account/";
      const link = `${origin}/account/login/?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;

      const from =
        settings.resendFromEmail || `Boots N Boogie <hello@${SITE.email.split("@")[1] || "bootsnboogie.local"}>`;
      const result = await sendResendEmail({
        apiKey: settings.resendApiKey,
        from,
        to: [email],
        subject: `Your ${SITE.name} sign-in link`,
        html: `
          <p>Hi${name ? ` ${name}` : ""},</p>
          <p>Click the button below to sign in to your ${SITE.name} dancer account. This link expires in 20 minutes and can only be used once.</p>
          <p style="margin:24px 0">
            <a href="${link}" style="background:#e8a017;color:#1a1208;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">
              Sign in to ${SITE.name}
            </a>
          </p>
          <p style="color:#666;font-size:13px">If the button doesn’t work, paste this link into your browser:<br/>${link}</p>
          <p style="color:#666;font-size:13px">If you didn’t request this, you can ignore this email.</p>
        `,
      });
      if (!result.ok) {
        throw new Error(
          result.error ||
            "Could not send email. In Admin → Payments, enable Resend and add an API key (or set RESEND_API_KEY on here.now)."
        );
      }
    },
    []
  );

  const consumeMagicLink = useCallback(async (token: string, emailHint?: string) => {
    if (!token) throw new Error("Missing sign-in link.");
    const token_hash = await sha256Hex(token);
    const rows = await listRecords<CmsContentData>("cms_content", 200);
    const now = Date.now();
    const candidates = rows.filter((r) => {
      if (r.data.content_type !== "auth_token") return false;
      if (r.data.record_status === "used" || r.data.record_status === "archived") return false;
      const body = parseJsonSafe<MagicTokenBody>(r.data.body_json, {
        token_hash: "",
        email: "",
        expires_at: "",
      });
      if (body.used) return false;
      if (body.token_hash !== token_hash) return false;
      if (emailHint && body.email.toLowerCase() !== emailHint.trim().toLowerCase()) return false;
      if (new Date(body.expires_at).getTime() < now) return false;
      return true;
    });

    if (!candidates.length) {
      throw new Error("This sign-in link is invalid or has expired. Request a new one.");
    }

    const tokenRec = candidates[0];
    const body = parseJsonSafe<MagicTokenBody>(tokenRec.data.body_json, {
      token_hash: "",
      email: "",
      expires_at: "",
    });

    // Mark used first to reduce replay window
    await updateRecord<CmsContentData>("cms_content", tokenRec.id, {
      record_status: "used",
      body_json: JSON.stringify({ ...body, used: true }),
    });

    const members = await listRecords<MemberData>("members", 200);
    let rec = members.find((m) => m.data.email.toLowerCase() === body.email.toLowerCase());
    if (!rec) {
      rec = await createMemberRecord({
        email: body.email,
        name: body.name || "Dancer",
        phone: body.phone,
        role: "dancer",
        mailing_list_opt_in: !!body.mailing_list_opt_in,
      });
    } else if (typeof body.mailing_list_opt_in === "boolean") {
      // Apply preference from the sign-in form when they re-request a link
      rec = await updateRecord<MemberData>("members", rec.id, {
        mailing_list_opt_in: body.mailing_list_opt_in,
      });
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: rec.id }));
    setUser(toSession(rec));
  }, []);

  const emergencyAdminLogin = useCallback(async (email: string, password: string) => {
    if (email.trim().toLowerCase() !== SEED_ADMIN.email.toLowerCase()) {
      throw new Error("Emergency login is only for the seed studio admin account.");
    }
    if (password !== SEED_ADMIN.password) {
      throw new Error("Incorrect setup password.");
    }
    const members = await listRecords<MemberData>("members", 200);
    let rec = members.find((m) => m.data.email.toLowerCase() === SEED_ADMIN.email.toLowerCase());
    if (!rec) {
      rec = await createMemberRecord({
        email: SEED_ADMIN.email,
        name: SEED_ADMIN.name,
        role: "admin",
      });
    } else if (rec.data.role !== "admin") {
      await updateRecord<MemberData>("members", rec.id, { role: "admin" });
      rec = { ...rec, data: { ...rec.data, role: "admin" } };
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: rec.id }));
    setUser(toSession(rec));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<MemberData>) => {
      if (!user) throw new Error("Not signed in");
      if (patch.email) {
        const email = String(patch.email).trim().toLowerCase();
        const members = await listRecords<MemberData>("members", 200);
        if (
          members.some(
            (m) => m.id !== user.id && m.data.email.toLowerCase() === email
          )
        ) {
          throw new Error("Another account already uses that email.");
        }
        patch = { ...patch, email };
      }
      const rec = await updateRecord<MemberData>("members", user.id, patch);
      setUser(toSession(rec));
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      siteDataReady,
      siteDataError,
      requestMagicLink,
      consumeMagicLink,
      emergencyAdminLogin,
      logout,
      refreshUser,
      updateProfile,
    }),
    [
      user,
      loading,
      siteDataReady,
      siteDataError,
      requestMagicLink,
      consumeMagicLink,
      emergencyAdminLogin,
      logout,
      refreshUser,
      updateProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
