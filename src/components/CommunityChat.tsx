"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  Hash,
  Loader2,
  LogOut,
  Megaphone,
  MessageCircle,
  Send,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
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
import { SITE, SUBSCRIPTION_PLAN } from "@/lib/data";
import type { ChatMessageData, SiteRecord } from "@/lib/sitedata";

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
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

function formatListTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function ChannelAvatar({ channel, size = 48 }: { channel: ChatChannel; size?: number }) {
  const announce = channel.adminOnlyPost || channel.kind === "announcements";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${
        announce
          ? "bg-gradient-to-br from-accent to-copper text-bg"
          : "bg-gradient-to-br from-surface to-bg-elevated text-accent ring-1 ring-line"
      }`}
      style={{ width: size, height: size }}
    >
      {announce ? <Megaphone size={size * 0.4} /> : <Hash size={size * 0.4} />}
    </div>
  );
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
  const [previews, setPreviews] = useState<Record<string, SiteRecord<ChatMessageData> | null>>({});
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** On narrow screens, show channel list until a chat is opened */
  const [mobileInChat, setMobileInChat] = useState(false);
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
      const last = msgs[msgs.length - 1] || null;
      setPreviews((prev) => ({ ...prev, [id]: last }));
    },
    [channels, maybeNotify]
  );

  const loadPreviews = useCallback(async (list: ChatChannel[]) => {
    const entries = await Promise.all(
      list.map(async (ch) => {
        try {
          const msgs = await listChannelMessages(ch.id, 1);
          return [ch.id, msgs[msgs.length - 1] || null] as const;
        } catch {
          return [ch.id, null] as const;
        }
      })
    );
    setPreviews((prev) => {
      const next = { ...prev };
      for (const [id, msg] of entries) next[id] = msg;
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission);
    if (Notification.permission === "granted" || standalone) {
      registerCommunityServiceWorker().catch(() => undefined);
    }
  }, [standalone]);

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
        await loadPreviews(list);
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

    const startInterval = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      const ms =
        typeof document !== "undefined" && document.visibilityState === "hidden" ? 2500 : 4000;
      pollRef.current = setInterval(poll, ms);
    };
    startInterval();

    const onVis = () => {
      if (document.visibilityState === "visible") poll();
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

  const openChannel = (id: string) => {
    primedRef.current = false;
    setChannelId(id);
    setMobileInChat(true);
    setBody("");
  };

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
      setSettingsOpen(false);
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
            ? "Notifications enabled — test alert sent."
            : "Permission granted. Keep Community open for alerts."
        );
      } else {
        setError(
          "Permission is on, but the browser blocked the test. On iPhone, Add to Home Screen first."
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
      body: "If you see this, local notifications work.",
      tag: `bnb-test-${Date.now()}`,
      url: "/community/",
    });
    if (ok) setInfo("Test notification sent.");
    else setError("Could not show a notification on this device.");
  }

  async function togglePref(
    key: "chat_notify_messages" | "chat_notify_announcements",
    value: boolean
  ) {
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

  const gateShell = standalone
    ? "flex min-h-0 flex-1 flex-col items-center justify-center px-4"
    : "card-surface p-6";

  if (!user) {
    return (
      <div className={`${gateShell} space-y-4 text-center`}>
        <MessageCircle className="mx-auto text-accent" size={28} />
        <p className="text-sm text-muted">Log in to access the subscriber community.</p>
        <Link href="/account/login/?next=/community/" className="btn-primary !py-2 text-sm">
          Log in
        </Link>
      </div>
    );
  }

  const isMember =
    user.role === "admin" || hasMembershipBenefits(user.subscription_status, user.period_end);

  if (!isMember) {
    return (
      <div className={`${gateShell} space-y-4`}>
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
      <div className={`${gateShell} space-y-4`}>
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
      <div className={`${gateShell} flex items-center justify-center gap-2 text-sm text-muted`}>
        <Loader2 className="animate-spin" size={16} /> Loading community…
      </div>
    );
  }

  const shell = standalone
    ? "wa-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    : "wa-shell flex min-h-[min(70vh,720px)] flex-col overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/40 md:min-h-[640px]";

  const showList = !mobileInChat;
  const showChat = mobileInChat;

  return (
    <div className={shell}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ── Chat list (WhatsApp-style sidebar) ── */}
        <aside
          className={`flex w-full flex-col border-line bg-[#120e0b] md:w-[340px] md:shrink-0 md:border-r ${
            showList ? "flex" : "hidden md:flex"
          }`}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-line bg-[#1a1410] px-3 py-3">
            <Image
              src="/images/logo.png"
              alt={SITE.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-contain"
              priority={standalone}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl leading-none tracking-wide text-cream">
                Community
              </p>
              <p className="truncate text-[11px] text-muted">{SITE.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-white/5 hover:text-cream"
              aria-label="Chat settings"
            >
              <Settings size={20} />
            </button>
          </header>

          <div className="border-b border-line px-4 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Member channels
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {channels.map((ch) => {
              const active = (activeChannel?.id || channelId) === ch.id;
              const prev = previews[ch.id];
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => openChannel(ch.id)}
                  className={`flex w-full items-center gap-3 border-b border-line/60 px-3 py-3 text-left transition ${
                    active ? "bg-accent/10" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <ChannelAvatar channel={ch} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-cream">{ch.title}</span>
                      <span className="shrink-0 text-[11px] text-muted">
                        {formatListTime(prev?.created_at || prev?.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted">
                      {prev
                        ? `${prev.data.member_name}: ${prev.data.body}`
                        : ch.description || "No messages yet"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {standalone && (
            <div className="shrink-0 border-t border-line px-3 py-2 text-center">
              <Link href="/account/" className="text-[11px] font-semibold text-accent hover:underline">
                Back to dancer studio
              </Link>
            </div>
          )}
        </aside>

        {/* ── Conversation pane ── */}
        <section
          className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${
            showChat ? "flex" : "hidden md:flex"
          }`}
        >
          {/* patterned chat background */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, #e8a017 0.6px, transparent 0.7px), radial-gradient(circle at 80% 40%, #c45c26 0.5px, transparent 0.6px), radial-gradient(circle at 40% 80%, #f3e6d0 0.5px, transparent 0.6px)",
              backgroundSize: "28px 28px, 36px 36px, 22px 22px",
            }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0f0b08] via-[#14100c] to-[#0c0907]" />

          <header className="relative z-10 flex shrink-0 items-center gap-2 border-b border-line bg-[#1a1410]/95 px-2 py-2.5 backdrop-blur-md sm:px-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-cream md:hidden"
              onClick={() => setMobileInChat(false)}
              aria-label="Back to chats"
            >
              <ArrowLeft size={20} />
            </button>
            {activeChannel && <ChannelAvatar channel={activeChannel} size={40} />}
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-cream">
                {activeChannel?.title || "Chat"}
              </h3>
              <p className="truncate text-[11px] text-muted">
                {activeChannel?.adminOnlyPost
                  ? "Studio announcements · admins only post"
                  : activeChannel?.description || "Member chat"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-white/5 hover:text-cream"
              aria-label="Chat settings"
            >
              <Settings size={20} />
            </button>
          </header>

          <div className="relative z-10 min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3 sm:px-4">
            {messages.length === 0 && (
              <div className="mx-auto mt-8 max-w-xs rounded-xl bg-bg-elevated/90 px-4 py-3 text-center text-sm text-muted shadow-lg">
                No messages yet — start the conversation.
              </div>
            )}
            {messages.map((m, idx) => {
              const mine = m.data.member_id === user.id;
              const prev = messages[idx - 1];
              const showName = !mine && (!prev || prev.data.member_id !== m.data.member_id);
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"} ${
                    showName || mine ? "mt-2" : "mt-0.5"
                  }`}
                >
                  <div
                    className={`relative max-w-[min(88%,28rem)] px-3 py-1.5 text-[15px] leading-snug shadow-md ${
                      mine
                        ? "rounded-2xl rounded-tr-sm bg-gradient-to-br from-accent to-[#c98a12] text-[#1a1208]"
                        : "rounded-2xl rounded-tl-sm border border-line/80 bg-[#1e1813] text-cream"
                    }`}
                  >
                    {showName && (
                      <p className="mb-0.5 text-[12px] font-bold text-accent">
                        {m.data.member_name}
                        {m.data.member_role === "admin" ? " · Studio" : ""}
                      </p>
                    )}
                    {mine && user.role === "admin" && m.data.member_role === "admin" && (
                      <p className="mb-0.5 text-[11px] font-bold text-[#1a1208]/70">You · Studio</p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.data.body}</p>
                    <div
                      className={`mt-0.5 flex items-center justify-end gap-1.5 text-[10px] ${
                        mine ? "text-[#1a1208]/65" : "text-muted"
                      }`}
                    >
                      {user.role === "admin" && (
                        <button
                          type="button"
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            mine ? "text-[#1a1208]/70 hover:text-[#1a1208]" : "text-red-400/80 hover:text-red-300"
                          }`}
                          onClick={() => onDeleteMessage(m.id)}
                          title="Delete message"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                      <span>{formatTime(m.created_at || m.createdAt)}</span>
                      {mine && <Check size={12} className="opacity-70" strokeWidth={2.5} />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {(error || info) && (
            <div className="relative z-10 shrink-0 px-3 pb-1">
              {error && (
                <p className="rounded-lg bg-red-500/15 px-3 py-1.5 text-center text-xs text-red-300">
                  {error}
                </p>
              )}
              {info && !error && (
                <p className="rounded-lg bg-accent/15 px-3 py-1.5 text-center text-xs text-accent">
                  {info}
                </p>
              )}
            </div>
          )}

          <form
            onSubmit={onSend}
            className="relative z-10 shrink-0 border-t border-line bg-[#1a1410] px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-3"
          >
            {activeChannel?.adminOnlyPost && user.role !== "admin" ? (
              <p className="rounded-full bg-bg/60 px-4 py-3 text-center text-xs text-muted">
                Only studio admins can post in Announcements. Open General to chat.
              </p>
            ) : (
              <div className="flex items-end gap-2">
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                  placeholder={
                    activeChannel?.adminOnlyPost ? "Post an announcement…" : "Type a message"
                  }
                  className="min-h-[44px] min-w-0 flex-1 rounded-full border border-line bg-[#120e0b] px-4 py-2.5 text-[15px] text-cream outline-none placeholder:text-muted/70 focus:border-accent/40 focus:ring-2 focus:ring-accent/25"
                />
                <button
                  type="submit"
                  disabled={busy || !body.trim()}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-[#1a1208] shadow-lg shadow-accent/20 transition hover:bg-accent-hover disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send size={18} className="ml-0.5" />
                </button>
              </div>
            )}
          </form>
        </section>
      </div>

      {/* Settings sheet */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="relative z-10 flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-line bg-[#1a1410] shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-accent" />
                <h3 className="font-display text-xl tracking-wide text-cream">Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-cream"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Notifications
                </p>
                <div className="space-y-3 rounded-xl border border-line bg-bg/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-cream">This device</span>
                    {perm !== "granted" && perm !== "unsupported" && (
                      <button
                        type="button"
                        className="btn-secondary !py-1.5 text-xs"
                        onClick={enableNotifications}
                      >
                        <Bell size={14} /> Allow
                      </button>
                    )}
                    {perm === "granted" && (
                      <span className="inline-flex items-center gap-1 text-xs text-accent">
                        <Bell size={12} /> Allowed
                      </span>
                    )}
                    {perm === "denied" && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-400">
                        <BellOff size={12} /> Blocked
                      </span>
                    )}
                  </div>

                  <label className="flex items-center justify-between gap-3 text-muted">
                    <span>Announcements</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--color-accent)]"
                      checked={user.chat_notify_announcements !== false}
                      onChange={(e) =>
                        togglePref("chat_notify_announcements", e.target.checked)
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-muted">
                    <span>General messages</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--color-accent)]"
                      checked={user.chat_notify_messages !== false}
                      onChange={(e) => togglePref("chat_notify_messages", e.target.checked)}
                    />
                  </label>

                  {perm === "granted" && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-cream underline-offset-2 hover:underline"
                      onClick={sendTestNotification}
                    >
                      Send test notification
                    </button>
                  )}

                  <p className="text-[11px] leading-relaxed text-muted">
                    Local alerts work while Community stays open or is installed (Add to Home
                    Screen). Fully closed-app push needs a dedicated push service.
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Account
                </p>
                <div className="space-y-2 rounded-xl border border-line bg-bg/40 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 font-bold text-accent">
                      {initials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-cream">{user.name}</p>
                      <p className="truncate text-xs text-muted">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    href="/account/"
                    className="block rounded-lg px-2 py-2 text-sm font-medium text-accent hover:bg-white/5"
                    onClick={() => setSettingsOpen(false)}
                  >
                    Open dancer studio
                  </Link>
                  {user.role !== "admin" && (
                    <button
                      type="button"
                      onClick={onLeave}
                      disabled={busy}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <LogOut size={14} /> Leave community chat
                    </button>
                  )}
                </div>
              </div>

              {(error || info) && (
                <div className="space-y-1">
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  {info && <p className="text-xs text-accent">{info}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
