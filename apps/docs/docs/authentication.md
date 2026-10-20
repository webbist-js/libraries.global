# Authentication

Better Auth in `apps/ui` owns public user accounts and cookie sessions. The browser does not receive a Strapi user JWT or the service bridge secret. Strapi admin authentication is separate from public accounts.

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

The current configuration uses database sessions with a 30-day lifetime and a one-day update interval. The Better Auth cookie cache is disabled. Read `apps/ui/src/lib/auth.ts` for current verification, password reset, magic-link, OAuth, passkey and two-factor configuration rather than reproducing those settings elsewhere.

## Client caches

Private query keys include user identity and the relevant library, locale or permission scope. `ClientProviders` creates a query client for each mounted account scope and discards it when identity changes. Do not put private data in module-level query clients, public response caches or unscoped browser storage.

## Legacy clients and proxies

`PrivateStrapiClient` and `/api/private-proxy` are compatibility surfaces. They do not create a JWT from a Better Auth session and must not be used as a new account API. The generic proxy allowlist permits published content reads, not account registration or arbitrary authenticated writes. New account functionality belongs behind a dedicated session-aware route and a permissioned Strapi endpoint.

## Admin plugins

Admin plugins use `useFetchClient` and registered admin routes, whose policies require both an authenticated admin and the appropriate plugin action. Wait for `useAuth` to finish before mounting permission checks. Treat permission-check errors separately from an actual denial. Credential reveals require their own permission, are audited server-side and clear their values when the dialog closes.

## Configuration and verification

The checked-in environment examples document variable names and placeholders. Runtime values and operator access details belong outside Git. Use `APP_PUBLIC_URL` for the accepted browser origin, `BETTER_AUTH_SECRET` for Better Auth and the server's configured bridge credentials for CMS calls.

Relevant checks include account route validation/origin tests, account-switch cache tests, access-role acceptance tests and the Strapi plugin interaction tests. Provider callbacks and billing acceptance require isolated local or sandbox fixtures; they must not send real invitations or charge live accounts.
