/** Browser / PWA notifications for community chat */

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export async function registerCommunityServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/community/sw.js", {
      scope: "/community/",
      updateViaCache: "none",
    });
    // Ensure the worker is active before we try to show notifications
    await navigator.serviceWorker.ready;
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    return reg;
  } catch {
    return null;
  }
}

/**
 * Show a local notification. Prefers service worker showNotification
 * (required on many mobile browsers / PWAs). Falls back to Notification().
 *
 * Note: Fully closed-app push (browser killed, device asleep) needs a push
 * server (VAPID) — not available on a pure static site without a backend.
 * Local alerts fire when the chat page (or installed app) is still open in
 * the background and polling picks up a new message.
 */
export async function showChatNotification(opts: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  const options = {
    body: opts.body,
    icon: "/images/logo.png",
    badge: "/images/logo.png",
    tag: opts.tag || "bnb-chat",
    data: { url: opts.url || "/community/" },
    renotify: true,
    requireInteraction: false,
  } as NotificationOptions;

  // Prefer SW registration.showNotification — works when tab is backgrounded
  try {
    let reg =
      (await navigator.serviceWorker.getRegistration("/community/")) ||
      (await registerCommunityServiceWorker());

    if (reg) {
      await navigator.serviceWorker.ready;
      // Ensure we have an active worker
      if (!reg.active) {
        reg = (await navigator.serviceWorker.getRegistration("/community/")) || reg;
      }
      await reg.showNotification(opts.title, options);
      return true;
    }
  } catch {
    /* fall through */
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(opts.title, options);
    return true;
  } catch {
    return false;
  }
}
