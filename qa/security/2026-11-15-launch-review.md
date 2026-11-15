# Public launch dependency review — 15 November 2026

The launch candidate removes the reported high-severity dependency paths. The
production dependency guard is unchanged and its exception list is empty.

## Replacements

- Official Strapi packages move together from 5.60.0 to 5.62.0, which uses patched
  webpack-dev-middleware 7.4.6.
- Plugin builds use Strapi SDK 6.1.1 and patched Vite 6.4.5. Iconhub moves to 1.3.1.
  Its published server and administrator bundles do not import the SDK; the
  version-scoped pnpm hook removes its unnecessary SDK 5 peer requirement. The
  actual SDK 5/pack-up/Vite 5 dependency edge is removed, not allowlisted.
- Strapi core/types use upstream koa-body 7.0.1 with patched Zod 4.6.7. This
  explicitly tested replacement is scoped to those exact Strapi parent versions.
  JSON, multipart upload shapes and request-size errors are covered by HTTP tests.
  Raw bytes use the upstream `request.rawBody` API; no CMS source consumes the old
  `unparsedBody` symbol. Controllers now narrow object bodies before reading keys.
- Koa-session 7.0.2 still depends on Zod 3 upstream. A committed compatibility
  patch migrates its configuration schema and declarations to Zod 4.6.7. Function
  options are checked with `z.custom` because Zod 4 function factories are no
  longer object-field schemas. Koa-session discards the result of its options
  parse, so its old argument/return wrappers were not used by runtime callbacks.
  The patch preserves callable checks, defaults and the session implementation.
  Signed cookies, tampering, expiry, logout and invalid options have HTTP/unit
  regression coverage. Both CommonJS and ESM distributions are patched.

The lockfile, version-scoped replacements and patch are part of the release.
Docker builds include the pnpm hook. No vulnerable dependency is hidden from the
audit and no expiry date is extended. Remove the session patch and manifest hook
when compatible upstream releases supply these corrections.

## Validation

Local production audit: zero high and zero critical findings; lower-severity
findings are still reported. CMS plugin/server/admin build and focused HTTP
compatibility checks passed. Full CI, exact-image auth and upload acceptance,
host-only backup/restore and rollback remain required before deployment.
