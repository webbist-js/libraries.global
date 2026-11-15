# Public launch dependency review — 15 November 2026

The public launch remains blocked by the dependency guard. No exception dates or
security checks were relaxed by this review.

The candidate updates the official Strapi packages together from 5.60.0 to
5.62.0. Its resolved webpack-dev-middleware 7.4.6 removes the previous
GHSA-g84c-rxfj-3j2c finding. Full CI and exact-image release acceptance are still
required for this CMS update.

Two high-severity findings remain:

- GHSA-587h-7wmj-h5pm: Vite 5.4.21 through the icon plugin's Strapi SDK/pack-up
  dependency. The icon plugin's 1.3.1 release still declares the SDK 5 peer, so
  upgrading the icon plugin alone does not remove this path. Production must
  continue to use the prebuilt administrator application, never a Vite server.
- GHSA-mrhx-c7xc-m3w5: Zod 3.25.76 through Strapi types and koa-body 6.0.1.
  Inspection of koa-body's published JavaScript shows its Zod parse validates
  middleware configuration at construction time, before the request handler is
  returned. Request bodies are parsed by co-body/formidable. This reduces the
  exposure of this particular dependency path but does not patch Zod, establish
  every usage in the final image, or authorize a new exception.

Resolve the findings through supported upstream releases or obtain an explicitly
reviewed, narrowly scoped exception backed by final-image reachability evidence
before promotion. Existing exceptions expired on 14 November 2026 and remain
expired.
