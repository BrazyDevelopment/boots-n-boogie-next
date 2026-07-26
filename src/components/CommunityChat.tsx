"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BellOff,
  Hash,
  Loader2,
  LogOut,
  Megaphone,
  MessageCircle,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  canAccessChat,
  deleteChatMessage,
  ensureDefaultChannels,
  enforceChatMembership,
  joinChat,
  leaveChat,
  listChannelMessages,
  postChatMessage,
  updateChatNotifyPrefs,
  type ChatChannel,
} from "@/lib/chat";
import {
  ensureNotificationPermission,
  registerCommunityServiceWorker,
  showChatNotification,
} from "@/lib/chat-notifications";
import { hasMembershipBenefits } from "@/lib/membership";
import { SUBSCRIPTION_PLAN } from "@/lib/data";
import type { ChatMessageData, SiteRecord } from "@/lib/sitedata";

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function CommunityChat({
  standalone = false,
}: {
  /** Full-height layout for /community PWA */
  standalone?: boolean;
}) {
  const { user, refreshUser } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [channelId, setChannelId] = useState<string>("");
  const [messages, setMessages] = useState<SiteRecord<ChatMessageData>[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  const access = canAccessChat({
    role: user?.role,
    subscription_status: user?.subscription_status,
    period_end: user?.period_end,
    chat_joined: user?.chat_joined,
  });

  const activeChannel = channels.find((c) => c.id === channelId) || channels[0];

  const loadChannels = useCallback(async () => {
    const list = await ensureDefaultChannels();
    setChannels(list);
    setChannelId((cur) => cur || list[0]?.id || "");
    return list;
  }, []);

  const maybeNotify = useCallback(
    async (msgs: SiteRecord<ChatMessageData>[], channel: ChatChannel | undefined) => {
      if (!user || !channel) return;
      if (!primedRef.current) {
        knownIdsRef.current = new Set(msgs.map((m) => m.id));
        primedRef.current = true;
        return;
      }
      const fresh = msgs.filter(
        (m) => !knownIdsRef.current.has(m.id) && m.data.member_id !== user.id
      );
      knownIdsRef.current = new Set(msgs.map((m) => m.id));
      if (!fresh.length) return;
      // User is looking at the chat — don't spam system notifications
      if (typeof window !== "undefined" && document.visibilityState === "visible") {
        return;
      }

      for (const m of fresh) {
        const isAnnounce = channel.adminOnlyPost || channel.kind === "announcements";
        if (isAnnounce && user.chat_notify_announcements === false) continue;
        if (!isAnnounce && user.chat_notify_messages === false) continue;
        if (typeof Notification !== "undefined" && Notification.permission !== "granted") continue;

        await showChatNotification({
          title: isAnnounce
            ? `Announcement · ${m.data.member_name}`
            : `${m.data.member_name} · ${channel.title}`,
          body: m.data.body.slice(0, 140),
          tag: `bnb-${channel.id}-${m.id}`,
          url: "/community/",
        });
      }
    },
    [user]
  );

  const loadMessages = useCallback(
    async (id: string) => {
      if (!id) return;
      const msgs = await listChannelMessages(id, 100);
      const ch = channels.find((c) => c.id === id);
      await maybeNotify(msgs, ch);
      setMessages(msgs);
    },
    [channels, maybeNotify]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
    // Always register SW on community so background notifications can show
    if (Notification.permission === "granted" || standalone) {
      registerCommunityServiceWorker().catch(() => undefined);
    }
  }, [standalone]);

  // Silent revoke if membership ended
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { revoked } = await enforceChatMembership({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          subscription_status: user.subscription_status,
          period_end: user.period_end,
          chat_joined: user.chat_joined,
          chat_revoked_notified: user.chat_revoked_notified,
        });
        if (revoked && !cancelled) {
          await refreshUser();
          setInfo(
            "Community chat access ended with your membership. Resubscribe anytime to rejoin."
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshUser]);

  useEffect(() => {
    if (!user) return;
    if (!access.allowed && access.reason !== "not_joined") {
      setLoading(false);
      return;
    }
    if (access.reason === "not_joined" && user.role !== "admin") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await loadChannels();
        if (cancelled) return;
        const id = channelId || list[0]?.id;
        if (id) {
          primedRef.current = false;
          await loadMessages(id);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load chat");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.chat_joined, user?.subscription_status, access.allowed, access.reason]);

  useEffect(() => {
    if (!access.allowed || !channelId) return;
    primedRef.current = false;
    loadMessages(channelId).catch(() => undefined);

    const poll = () => {
      loadMessages(channelId).catch(() => undefined);
    };

    // Faster poll while backgrounded so we still pick up messages before the
    // browser freezes timers entirely (local notifications only work while the
    // page/app is alive — dedicated push is needed for closed-app delivery).
    const startInterval = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      const ms =
        typeof document !== "undefined" && document.visibilityState === "hidden" ? 2500 : 4000;
      pollRef.current = setInterval(poll, ms);
    };
    startInterval();

    const onVis = () => {
      if (document.visibilityState === "visible") {
        poll();
      }
      startInterval();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [access.allowed, channelId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, channelId]);

  async function onJoin() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      if (
        user.role !== "admin" &&
        !hasMembershipBenefits(user.subscription_status, user.period_end)
      ) {
        throw new Error("Active membership required to join the community chat.");
      }
      await joinChat(user.id);
      await refreshUser();
      setInfo("You’re in! Welcome to the Boots N Boogie community.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    } finally {
      setBusy(false);
    }
  }

  async function onLeave() {
    if (!user) return;
    if (!confirm("Leave the community chat? You can rejoin while your membership is active.")) {
      return;
    }
    setBusy(true);
    try {
      await leaveChat(user.id);
      await refreshUser();
      setInfo("You’ve left the community chat.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not leave");
    } finally {
      setBusy(false);
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!user || !activeChannel) return;
    setBusy(true);
    setError(null);
    try {
      await postChatMessage({
        channel: activeChannel,
        memberId: user.id,
        memberEmail: user.email,
        memberName: user.name,
        memberRole: user.role,
        body,
      });
      setBody("");
      await loadMessages(activeChannel.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteMessage(id: string) {
    if (!confirm("Delete this message for everyone?")) return;
    setBusy(true);
    try {
      await deleteChatMessage(id);
      await loadMessages(channelId || activeChannel?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  async function enableNotifications() {
    setError(null);
    const p = await ensureNotificationPermission();
    setPerm(p);
    if (p === "granted") {
      const reg = await registerCommunityServiceWorker();
      const ok = await showChatNotification({
        title: "Boots N Boogie",
        body: "Notifications are working on this device.",
        tag: "bnb-test",
        url: "/community/",
      });
      if (ok) {
        setInfo(
          reg
            ? "Notifications enabled — you should see a test alert. Keep Community open (or Add to Home Screen) for new-message alerts."
            : "Permission granted. Keep this page open in the background to receive chat alerts."
        );
      } else {
        setError(
          "Permission is on, but the browser blocked the test notification. On iPhone, Add to Home Screen first, then allow notifications from the installed app."
        );
      }
    } else if (p === "denied") {
      setError("Notifications blocked. Enable them in your browser or phone settings.");
    }
  }

  async function sendTestNotification() {
    setError(null);
    const p = await ensureNotificationPermission();
    setPerm(p);
    if (p !== "granted") {
      setError("Allow notifications first.");
      return;
    }
    await registerCommunityServiceWorker();
    const ok = await showChatNotification({
      title: "Test · Boots N Boogie",
      body: "If you see this, local notifications work. New chat messages only alert while Community is open or installed.",
      tag: `bnb-test-${Date.now()}`,
      url: "/community/",
    });
    if (ok) setInfo("Test notification sent.");
    else setError("Could not show a notification on this device.");
  }

  async function togglePref(key: "chat_notify_messages" | "chat_notify_announcements", value: boolean) {
    if (!user) return;
    setBusy(true);
    try {
      await updateChatNotifyPrefs(user.id, { [key]: value });
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save preference");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="card-surface space-y-4 p-6 text-center">
        <MessageCircle className="mx-auto text-accent" size={28} />
        <p className="text-sm text-muted">Log in to access the subscriber community.</p>
        <Link href="/account/login/?next=/community/" className="btn-primary !py-2 text-sm">
          Log in
        </Link>
      </div>
    );
  }

  const isMember =
    user.role === "admin" ||
    hasMembershipBenefits(user.subscription_status, user.period_end);

  if (!isMember) {
    return (
      <div className="card-surface space-y-4 p-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="text-accent" size={22} />
          <h2 className="font-display text-2xl tracking-wide">Subscriber community</h2>
        </div>
        <p className="text-sm text-muted">
          The community chat is a perk of the £{SUBSCRIPTION_PLAN.amountGbp}/month membership —
          announcements from the studio plus a general chat with fellow dancers.
        </p>
        <Link href="/subscribe/" className="btn-primary !py-2 text-sm">
          View membership
        </Link>
      </div>
    );
  }

  if (!user.chat_joined && user.role !== "admin") {
    return (
      <div className="card-surface space-y-4 p-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="text-accent" size={22} />
          <h2 className="font-display text-2xl tracking-wide">Subscriber community</h2>
        </div>
        <p className="text-sm text-muted">
          Opt in to join our member community: studio announcements and a friendly general chat.
          You can leave anytime. If your membership ends, access is removed automatically.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-accent">{info}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={onJoin}
          className="btn-primary !py-2 text-sm disabled:opacity-50"
        >
          {busy ? "Joining…" : "Join community chat"}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="animate-spin" size={16} /> Loading community…
      </div>
    );
  }

  const shell = standalone ? "flex h-[100dvh] flex-col" : "space-y-4";
  const chatHeight = standalone ? "min-h-0 flex-1" : "min-h-[420px]";

  return (
    <div className={shell}>
      <div className={`flex flex-wrap items-start justify-between gap-3 ${standalone ? "shrink-0 px-1 pb-2" : ""}`}>
        <div>
          <h2 className="font-display text-2xl tracking-wide">Community chat</h2>
          <p className="mt-1 text-sm text-muted">
            Member-only ·{" "}
            {standalone ? (
              <Link href="/account/" className="text-accent hover:underline">
                Open full studio
              </Link>
            ) : (
              <Link href="/community/" className="text-accent hover:underline">
                Open chat app (Add to Home Screen)
              </Link>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {user.role !== "admin" && (
            <button
              type="button"
              onClick={onLeave}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-red-400"
            >
              <LogOut size={14} /> Leave
            </button>
          )}
        </div>
      </div>

      {/* Notification prefs */}
      <div
        className={`card-surface space-y-3 p-4 text-sm ${standalone ? "mx-0 mb-2 shrink-0" : ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-cream">Notifications</p>
          {perm !== "granted" && perm !== "unsupported" && (
            <button
              type="button"
              className="btn-secondary !py-1.5 text-xs"
              onClick={enableNotifications}
            >
              <Bell size={14} className="mr-1 inline" />
              Allow on this device
            </button>
          )}
          {perm === "granted" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-accent">
                <Bell size={12} /> Allowed on this device
              </span>
              <button
                type="button"
                className="text-xs font-semibold text-cream underline-offset-2 hover:underline"
                onClick={sendTestNotification}
              >
                Send test
              </button>
            </div>
          )}
          {perm === "denied" && (
            <span className="inline-flex items-center gap-1 text-xs text-red-400">
              <BellOff size={12} /> Blocked in browser settings
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-muted">
          <input
            type="checkbox"
            checked={user.chat_notify_announcements !== false}
            onChange={(e) => togglePref("chat_notify_announcements", e.target.checked)}
          />
          Announcements
        </label>
        <label className="flex items-center gap-2 text-muted">
          <input
            type="checkbox"
            checked={user.chat_notify_messages !== false}
            onChange={(e) => togglePref("chat_notify_messages", e.target.checked)}
          />
          General / channel messages
        </label>
        <p className="text-[11px] text-muted">
          Local alerts fire when Community stays open (or is installed via Add to Home Screen) and a
          new message arrives while the screen is away from the chat. Fully closed-app push needs a
          dedicated push service — not set up yet on this static host.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {info && <p className="text-sm text-accent">{info}</p>}

      <div
        className={`card-surface grid overflow-hidden md:grid-cols-[200px_1fr] ${chatHeight} ${
          standalone ? "min-h-0 border-0 bg-transparent shadow-none" : ""
        }`}
      >
        <aside className="border-b border-line bg-bg/40 p-3 md:border-b-0 md:border-r">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted">
            Channels
          </p>
          <div className="flex gap-1 overflow-x-auto md:flex-col">
            {channels.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  primedRef.current = false;
                  setChannelId(ch.id);
                }}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                  (activeChannel?.id || channelId) === ch.id
                    ? "bg-accent/15 font-semibold text-accent"
                    : "text-muted hover:bg-white/5 hover:text-cream"
                }`}
              >
                {ch.adminOnlyPost ? <Megaphone size={14} /> : <Hash size={14} />}
                {ch.title}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-h-0 min-h-[360px] flex-col">
          <div className="shrink-0 border-b border-line px-4 py-3">
            <h3 className="font-semibold text-cream">{activeChannel?.title || "Chat"}</h3>
            {activeChannel?.description && (
              <p className="text-xs text-muted">{activeChannel.description}</p>
            )}
            {activeChannel?.adminOnlyPost && (
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                Admins only can post
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted">No messages yet — start the conversation.</p>
            )}
            {messages.map((m) => {
              const mine = m.data.member_id === user.id;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3.5 py-2 text-sm ${
                      mine
                        ? "bg-accent/20 text-cream"
                        : "border border-line bg-bg/60 text-cream"
                    }`}
                  >
                    <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-bold text-accent">
                        {m.data.member_name}
                        {m.data.member_role === "admin" ? " · Studio" : ""}
                      </span>
                      <span className="text-muted">
                        {formatTime(m.created_at || m.createdAt)}
                      </span>
                      {user.role === "admin" && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 font-bold text-red-400 hover:text-red-300"
                          onClick={() => onDeleteMessage(m.id)}
                          title="Delete message"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words">{m.data.body}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSend} className="shrink-0 border-t border-line p-3">
            {activeChannel?.adminOnlyPost && user.role !== "admin" ? (
              <p className="text-center text-xs text-muted">
                Only studio admins can post in Announcements. Browse General chat to reply.
              </p>
            ) : (
              <div className="flex gap-2">
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                  placeholder={
                    activeChannel?.adminOnlyPost
                      ? "Post an announcement…"
                      : "Write a message…"
                  }
                  className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                />
                <button
                  type="submit"
                  disabled={busy || !body.trim()}
                  className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50"
                  aria-label="Send"
                >
                  <Send size={16} />
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
