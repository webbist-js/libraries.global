/* Only public static assets are cached. Signed-in HTML and every API stay on the network. */
const CACHE = "libraries-live-shell-v1"
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["/live-icon.svg", "/live-offline.html"]))
  )
  self.skipWaiting()
})
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("libraries-live-shell-") && key !== CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/live-offline.html").then(async (cached) => {
          const headers = new Headers(cached.headers)
          headers.set(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'"
          )
          headers.set("Cache-Control", "no-store")
          headers.set("Referrer-Policy", "no-referrer")
          headers.set("X-Frame-Options", "DENY")

          return new Response(await cached.text(), { headers })
        })
      )
    )

    return
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/live-icon.svg"
  )
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE).then((cache) => cache.put(event.request, copy))
            }

            return response
          })
      )
    )
})
