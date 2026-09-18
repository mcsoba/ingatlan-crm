// Minimal service worker: only exists so the app satisfies PWA installability
// criteria. Intentionally no caching strategy — every request still goes to
// the network untouched.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No-op: let the browser handle the request normally.
});
