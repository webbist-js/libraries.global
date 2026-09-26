/**
 * CORS origins that may make credentialed requests to Strapi.
 * - CORS_ORIGINS: comma-separated list (set the production app URL here).
 * - CLIENT_URL is always included.
 * - ngrok tunnels are only allowed outside production, and only when
 *   ALLOW_NGROK_ORIGINS=true — otherwise any ngrok customer could send
 *   credentialed requests.
 */
function corsOrigins(env: any): (string | RegExp)[] {
  const isProd = env("NODE_ENV") === "production"
  const configured = env
    .array("CORS_ORIGINS", [])
    .map((o: string) => o.trim())
    .filter(Boolean)
  const origins: (string | RegExp)[] = [
    ...new Set<string>([env("CLIENT_URL", ""), ...configured].filter(Boolean)),
  ]
  if (!isProd) {
    origins.push("http://localhost:3000", "http://127.0.0.1:3000")
    if (env.bool("ALLOW_NGROK_ORIGINS", false)) {
      origins.push(
        /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/,
        /^https:\/\/[a-z0-9-]+\.ngrok\.io$/
      )
    }
  }

  return origins
}

export default ({ env }: { env: any }) => [
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:"],
          "script-src": [
            "'self'",
            "unsafe-inline",
            "https://unpkg.com",
            "https://maps.googleapis.com",
            "https://*.basemaps.cartocdn.com",
          ],
          "style-src": ["'self'", "'unsafe-inline'", "https://unpkg.com"],
          "media-src": [
            "'self'",
            "blob:",
            "data:",
            "https://maps.gstatic.com",
            "https://maps.googleapis.com",
            "https://*.basemaps.cartocdn.com",
            "https://tile.openstreetmap.org",
            "https://*.tile.openstreetmap.org",
            "*.amazonaws.com",
          ],
          "frame-src": ["'self'", "https://www.openstreetmap.org"],
          "img-src": [
            "'self'",
            "blob:",
            "data:",
            "https://maps.gstatic.com",
            "https://maps.googleapis.com",
            "https://*.basemaps.cartocdn.com",
            "https://tile.openstreetmap.org",
            "https://*.tile.openstreetmap.org",
            "khmdb0.google.com",
            "khmdb0.googleapis.com",
            "khmdb1.google.com",
            "khmdb1.googleapis.com",
            "khm.google.com",
            "khm.googleapis.com",
            "khm0.google.com",
            "khm0.googleapis.com",
            "khm1.google.com",
            "khm1.googleapis.com",
            "khms0.google.com",
            "khms0.googleapis.com",
            "khms1.google.com",
            "khms1.googleapis.com",
            "khms2.google.com",
            "khms2.googleapis.com",
            "khms3.google.com",
            "khms3.googleapis.com",
            "streetviewpixels-pa.googleapis.com",
            "market-assets.strapi.io",
            "https://unpkg.com/leaflet@1.9.4/dist/images/",
            "*.amazonaws.com",
          ],
        },
      },
    },
  },
  {
    name: "strapi::cors",
    config: {
      // Explicitly list headers — "*" is not reliably handled by all browsers in preflight
      headers: [
        "Content-Type",
        "Authorization",
        "Origin",
        "Accept",
        "X-Requested-With",
        "cookie",
      ],
      // Allow credentials (cookies) — required for Better Auth session cookies
      credentials: true,
      origin: corsOrigins(env),
    },
  },
  "strapi::poweredBy",
  "strapi::logger",
  "strapi::query",
  "strapi::body",
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
  "strapi::compression",
]
