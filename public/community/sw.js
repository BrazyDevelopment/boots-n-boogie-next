/* Boots N Boogie community PWA service worker — notifications + light offline shell.
 * Scope is /community/ only so main-site navigations are never intercepted.
 * Version bump forces clients to pick up fixes after deploy.
 */
const CACHE = "bnb-community-v3";
const PRECACHE = ["/community/manifest.webmanifest", "/images/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (data.type === "SHOW_NOTIFICATION" && data.title) {
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body || "",
        icon: "/images/logo.png",
        badge: "/images/logo.png",
        tag: data.tag || "bnb-chat",
        data: { url: data.url || "/community/" },
        renotify: true,
      })
    );
  }
});

/**
 * Only cache static assets under /community and the logo.
 * Never cache HTML documents — stale HTML + new JS chunks caused broken
 * navigations / "please reload" style failures on mobile after deploys.
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never touch Next.js chunks or non-community routes
  if (url.pathname.startsWith("/_next/")) return;
  if (!url.pathname.startsWith("/community") && url.pathname !== "/images/logo.png") return;

  // Navigations / HTML: network only (no cache)
  const accept = req.headers.get("accept") || "";
  if (req.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(fetch(req));
    return;
  }

  // Manifest / logo: network-first with cache fallback
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || Response.error()))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/community/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/community") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
