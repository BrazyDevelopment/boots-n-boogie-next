"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { SEED_ADMIN, SITE } from "@/lib/data";

function LoginForm() {
  const { requestMagicLink, consumeMagicLink, emergencyAdminLogin, siteDataError, user } =
    useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account/";
  const urlToken = params.get("token") || "";
  const urlEmail = params.get("email") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(urlEmail);
  const [phone, setPhone] = useState("");
  const [mailingList, setMailingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(!!urlToken);
  const [showSetup, setShowSetup] = useState(false);
  const [setupPassword, setSetupPassword] = useState("");

  // Auto-complete magic link when opened from email
  useEffect(() => {
    if (!urlToken) return;
    let cancelled = false;
    (async () => {
      setVerifying(true);
      setError(null);
      try {
        await consumeMagicLink(urlToken, urlEmail || undefined);
        if (!cancelled) router.replace(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not verify sign-in link");
          setVerifying(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlToken, urlEmail, consumeMagicLink, router, next]);

  useEffect(() => {
    if (user && !urlToken) router.replace(next);
  }, [user, urlToken, router, next]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await requestMagicLink(email, {
        name,
        phone,
        mailing_list_opt_in: mailingList,
      });
      setSent(true);
      setInfo(
        `We’ve emailed a sign-in link to ${email.trim()}. Open it on this device within 20 minutes.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (verifying) {
    return (
      <div className="card-surface mx-auto max-w-md p-8 text-center">
        <p className="font-display text-2xl tracking-wide text-cream">Signing you in…</p>
        <p className="mt-2 text-sm text-muted">Checking your magic link.</p>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {error && (
          <button
            type="button"
            className="btn-secondary mt-6 !py-2 text-sm"
            onClick={() => {
              setVerifying(false);
              setSent(false);
            }}
          >
            Request a new link
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={onSubmit} className="card-surface space-y-4 p-7">
        <div>
          <h2 className="font-display text-2xl tracking-wide">Passwordless sign-in</h2>
          <p className="mt-1 text-sm text-muted">
            We’ll email you a one-time magic link — no password needed.
          </p>
        </div>

        <label className="block text-sm font-semibold">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>

        <label className="block text-sm font-semibold">
          Full name{" "}
          <span className="font-normal text-muted">(required for new accounts)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="e.g. Jane Smith"
          />
        </label>

        <label className="block text-sm font-semibold">
          Phone <span className="font-normal text-muted">(optional)</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>

        <label className="flex items-start gap-3 rounded-xl border border-line bg-bg/40 p-3 text-sm">
          <input
            type="checkbox"
            checked={mailingList}
            onChange={(e) => setMailingList(e.target.checked)}
            className="mt-0.5 accent-[var(--color-accent)]"
          />
          <span>
            <span className="font-semibold text-cream">Email updates &amp; mailing list</span>
            <span className="mt-1 block text-xs font-normal text-muted">
              Opt in to news, class tips and event announcements. You can change this anytime in
              your dancer studio. Active members are also on a separate subscriber list
              automatically.
            </span>
          </span>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-accent">{info}</p>}
        {siteDataError && <p className="text-xs text-copper">{siteDataError}</p>}

        <button type="submit" disabled={busy || sent} className="btn-primary w-full disabled:opacity-50">
          {busy ? "Sending link…" : sent ? "Link sent — check your email" : "Email me a magic link"}
        </button>

        {sent && (
          <button
            type="button"
            className="w-full text-center text-sm font-semibold text-muted hover:text-accent"
            onClick={() => {
              setSent(false);
              setInfo(null);
            }}
          >
            Use a different email
          </button>
        )}
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          className="text-xs font-semibold text-muted hover:text-accent"
          onClick={() => setShowSetup((v) => !v)}
        >
          Studio setup login (before email is configured)
        </button>
      </div>
      {showSetup && (
        <form
          className="card-surface mt-3 space-y-3 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await emergencyAdminLogin(SEED_ADMIN.email, setupPassword);
              router.push("/admin/");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Setup login failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-xs text-muted">
            Use only to open Admin and enable Resend for magic links. Email:{" "}
            <code className="text-cream">{SEED_ADMIN.email}</code>
          </p>
          <input
            type="password"
            value={setupPassword}
            onChange={(e) => setSetupPassword(e.target.value)}
            placeholder="Setup password"
            className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button type="submit" disabled={busy} className="btn-secondary w-full !py-2 text-sm">
            Open admin
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/" className="text-accent hover:underline">
          ← Back home
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-muted">
        Magic-link emails are sent via Resend for {SITE.name}. Check spam if you don’t see the
        link.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <section className="container-page py-28 md:py-36">
      <div className="mb-10 text-center">
        <p className="section-label">Dancer accounts</p>
        <h1 className="mt-3 font-display text-4xl tracking-wide md:text-5xl">Welcome</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Book classes, manage socials and memberships — sign in with a magic link to your email.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </section>
  );
}
