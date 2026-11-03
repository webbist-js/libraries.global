# Authentication

The Strapi Better Auth plugin owns public accounts, credentials, cookie sessions and profile provisioning. Next.js forwards `/api/auth/*` to Strapi with the server bridge credential; the browser keeps the same origin and cookie interface. Strapi admin authentication is separate.

Strapi synchronizes the checked-in plugin schemas and installs database invariants at startup. Next.js only prepares its application-owned `app_auth_state` table for beta throttling and mobile confirmation. It never migrates or queries credential tables. Run `pnpm --filter @repo/strapi generate:auth-schema` when changing Better Auth fields/plugins, inspect the private fields and numeric types, then run `pnpm --filter @repo/strapi generate:types`.

Google and Discord appear only when both credentials for that provider are configured in the CMS. Register callbacks at `{APP_PUBLIC_URL}/api/auth/callback/google` and `{APP_PUBLIC_URL}/api/auth/callback/discord`. OAuth signup carries the current terms acceptance; Discord requires a verified email address. Email/password requires verified ownership; magic links are sign-in only. The mobile live console retains its passkey registration and identity-confirmation controls.

## Request boundary

1. A browser sends its Better Auth session cookie to a dedicated Next.js route.
2. The route reads the session server-side and validates the origin, input size and input schema before a write.
3. The route constructs the upstream URL and the trusted user headers itself. It never accepts a caller-supplied user ID as proof of identity.
4. Strapi verifies the service secret and rechecks the current user's capabilities, staff assignments or entitlements for the requested operation.
5. The route returns the operation's public or owner-specific response, without credentials or unrelated account fields.

Use the existing feature proxies and `bridge-user-headers.ts` for server-to-server requests. Keep `STRAPI_BRIDGE_SECRET`, API keys and provider credentials server-side. A public content token is for allowed published reads; it does not confer a public user's permissions.

## Sessions

Server components use `getSessionSSR` from `@/lib/auth-server`. Route handlers can use `auth.api.getSession` with the incoming headers. Client components use `useHydratedSession` from `@/lib/access-client`; it preserves the server's signed-out/loading render until hydration completes.

```typescript
import { headers } from "next/headers"
import { getSessionSSR } from "@/lib/auth-server"

const session = await getSessionSSR(await headers())
if (!session?.user) {
  // Redirect to sign-in, or return 401 from an API route.
}
```

The session includes the user's identity and the access projection needed by the interface. UI capability checks explain or hide actions. Strapi remains authoritative for writes, scoped moderation, library staff access and plan-gated operations. Roles and plan entitlements are separate: payment never grants editorial or staff authority.

Selected section entry pages show a contextual invitation before sign-in.
See [Feature entry pages](feature-entry-pages.md) for the redirect audit, public
discovery paths and the private actions that retain direct gates.

The current configuration uses database sessions with a 30-day lifetime and a one-day update interval. The Better Auth cookie cache is disabled. Read `apps/strapi/src/auth/config.ts` for verification, password reset, magic-link, OAuth and passkey configuration. Server reads disable session refresh because they cannot forward response cookies; browser auth requests forward every Set-Cookie header.

## Roles and policies

Users & Permissions is removed: the adapter cannot coexist with it. The optional API Permissions companion is not installed. Role Grants remain the sole community-role authority, with queue, locale and expiry scope; staff and Team memberships and paid entitlements are separate. The `global::moderation` policy resolves trusted identity and capabilities once per request. Resource checks, self-review restrictions and transaction-time authority checks still apply.

For an owner-only example, follow `/api/account/profile`: `global::service-auth` restricts the transport, then `global::account-session` resolves the Better Auth cookie and sets the request identity. The controller selects that user’s related profile and removes private identity fields. A forged `X-Ba-User-Id` cannot replace the cookie identity. Next.js uses this route for its own-profile read. Manage grants through the existing CMS access tools, not a duplicate U&P role catalogue.

Generated public content routes use an explicit read-only auth strategy preserving the former public read actions. Core API tokens retain their own strategy. Auth transport and internal identity/password/retention operations require the service secret. The adapter's missing-API-Permissions startup warning refers to its companion strategy; this application supplies its own policies and public-read strategy.

The plugin is pinned and patched: compound predicates must survive adapter conversion, token/counter mutations must be atomic, and internal Strapi fields must not enter Better Auth guards. Regression tests are required before removing the patch or upgrading.

## Transport configuration

Keep `BETTER_AUTH_SECRET`, OAuth credentials and `APPLICATION_DATABASE_URL` in the CMS runtime. Next.js retains its application `DATABASE_URL`, `STRAPI_URL` and shared `STRAPI_BRIDGE_SECRET`. Event feed OAuth uses an independent `EVENT_FEED_OAUTH_SECRET`. No credential belongs in a public environment variable.

The gateway drops caller-supplied identity and service headers. Enable `AUTH_TRUST_PROXY_IP=true` only where a trusted reverse proxy replaces inbound forwarding headers. Otherwise rate limits use the transport peer address, which can group visitors together. The outbound origin comes only from `STRAPI_URL`; browser paths must contain plain auth route segments, with encoded separators and dot segments rejected before forwarding. OAuth code/state stay in query parameters and cannot select an upstream host. Browser bodies are bounded, responses are uncached, and redirects and cookies are preserved. The plugin extension restores JSON `null` for signed-out session reads because Koa otherwise turns it into an empty 204 response. Keep the CMS auth handler inaccessible without the service credential.

## Beta reset

The one-shot reset discards public accounts and profiles, account-owned beta activity and test billing bindings. Catalogue/editorial values, dates, provenance, administrators and service access remain. Historical contributions become explicitly labelled system baselines, excluded from new-edit counts. New users receive new profiles; no matching by email occurs. See [reset procedure](../../../scripts/auth/README.md) and [architecture decision](decisions/strapi-hosted-authentication.md). No destructive reset runs during normal startup.

## Client caches

Private query keys include user identity and the relevant library, locale or permission scope. `ClientProviders` creates a query client for each mounted account scope and discards it when identity changes. Do not put private data in module-level query clients, public response caches or unscoped browser storage.

## Legacy clients and proxies

`PrivateStrapiClient` and `/api/private-proxy` are compatibility surfaces. They do not create a JWT from a Better Auth session and must not be used as a new account API. The generic proxy allowlist permits published content reads, not account registration or arbitrary authenticated writes. New account functionality belongs behind a dedicated session-aware route and a permissioned Strapi endpoint.

## Admin plugins

Admin plugins use `useFetchClient` and registered admin routes, whose policies require both an authenticated admin and the appropriate plugin action. Wait for `useAuth` to finish before mounting permission checks. Treat permission-check errors separately from an actual denial. Credential reveals require their own permission, are audited server-side and clear their values when the dialog closes.

## Strapi admin Google SSO

Admin SSO requires a Strapi license with the SSO feature. It uses the Google
Passport strategy in `apps/strapi/src/utils/admin-google-sso.ts` and is separate
from Better Auth website sessions.

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the CMS runtime environment,
then set `STRAPI_ADMIN_GOOGLE_SSO_ENABLED=true`. The client may be shared with
the website, but the CMS needs its own environment entries. Register the admin
callback as an additional authorized redirect URI in Google Cloud; retain the
website's existing callback. By default the admin callback is
`{browser-facing CMS origin}/admin/connect/google`.

Set `STRAPI_ADMIN_GOOGLE_CALLBACK_URL` to the complete callback URL when the
browser reaches the CMS through a different origin, such as a private tunnel.
Start and finish login on the same origin so the OAuth state cookie survives
the redirect. Retain the session middleware: the strategy validates state and
uses PKCE with S256.

For a private production CMS reached only through an encrypted SSH tunnel, set
`STRAPI_ADMIN_SSO_LOOPBACK=true` with an explicit HTTP loopback callback. This
allows the OAuth state and admin cookies on the tunnel's local HTTP endpoint
and sets the admin panel URL to the callback's origin. SSO success and error
redirects stay on that origin while the server's APP_URL remains unchanged.
The configuration rejects non-loopback callbacks in this mode. Keep this flag
off for HTTPS deployments and never use it with a public HTTP CMS.

Set `STRAPI_ADMIN_GOOGLE_ALLOWED_EMAILS` to the comma-separated administrator
email allowlist. Enabling Google SSO without a non-empty allowlist fails startup.
Only a verified Google email on that list matching an existing active Strapi
administrator can sign in. Existing roles are preserved. The provider rejects other accounts
even if auto-registration is enabled in Strapi; keep auto-registration off in
Settings > Global settings > Single Sign-On. Keep local authentication enabled,
particularly for Super Admin, so password login remains available for recovery.

Rebuild and restart Strapi after deployment configuration changes. Verify that
the Google provider appears on the admin login screen, complete a sign-in with
an existing administrator, and check that an unregistered account is rejected.
Production changes follow the protected release and private acceptance process.
Setting `STRAPI_ADMIN_GOOGLE_SSO_ENABLED=false` and restarting removes the
provider without changing administrator accounts.

See Strapi's [Google SSO setup](https://docs.strapi.io/cms/configurations/sso-providers/google)
and [SSO settings](https://docs.strapi.io/cms/features/sso).

## Configuration and verification

The checked-in environment examples document variable names and placeholders. Runtime values and operator access details belong outside Git. Use `APP_PUBLIC_URL` for the accepted browser origin, `BETTER_AUTH_SECRET` for Better Auth and the server's configured bridge credentials for CMS calls.

Relevant checks include account route validation/origin tests, account-switch cache tests, access-role acceptance tests and the Strapi plugin interaction tests. Provider callbacks and billing acceptance require isolated local or sandbox fixtures; they must not send real invitations or charge live accounts.

## Beta welcome

The protected beta shell mounts a welcome dialog after the session has loaded.
It introduces search, contributions, Team subscriptions, the API and the existing
Feedback form. Test-card instructions are shown only for sandbox billing; the
copy makes the pre-launch data wipe explicit. The public beta entrance, sign-in,
live console and active Team checkout pages are kept clear of the welcome.

Dismissal is functional session storage (`lg.beta-welcome.v1`), scoped to the
current account or guest. A new tab/account or thirty minutes away starts a new
visit; ordinary route changes and reloads retain dismissal. When browser storage
is unavailable, the mounted visit retains its dismissal in memory. The dialog
loads lazily and uses the shared accessible modal. Closing it does not accept
terms, subscribe to anything or send feedback.
