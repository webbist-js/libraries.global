# Strapi hosts public authentication and scoped access policies

Status: Implemented and locally validated (2026-11-03). Not deployed.

## Context

Before this retrofit, Better Auth ran in Next.js. Strapi stores public profiles, scoped role grants, library/Team memberships and entitlements. Dedicated Next.js routes resolve cookie sessions and assert identity through a server bridge. Some application jobs also query the authentication tables directly. Users & Permissions contains duplicate public users but does not represent our application roles.

We want the repository to demonstrate Strapi-native authentication and authorization. The beta permits a clean public-account reset: users register again, and test billing, profile and contribution activity can be discarded. Catalogue records, editorial content, provenance and service/admin access must survive. Resetting accounts must not remove application functionality.

## Alternatives considered

1. Keep Better Auth in Next.js and add Discord. Smallest change, but retains the split ownership and does not meet the Strapi development-example objective.
2. Move auth and also adopt the companion API Permissions plugin. Provides endpoint RBAC and an admin role editor, but still needs our locale, queue, library, expiry and ownership checks. It would introduce overlapping role authorities unless we replaced the entire scoped-grant model.
3. Move Better Auth to Strapi and use native route policies backed by existing scoped grants. Chosen: one auth owner and one domain permission authority, with reusable policies and services.
4. Preserve all existing account identities through a mapping layer. Rejected for this beta reset: it adds permanent compatibility work without a data-preservation requirement.

## Decision

Use the pinned Strapi Better Auth adapter with email/password, Google, Discord, magic links and passkeys. Strapi owns credentials, sessions, account lifecycle and profile provisioning. Public accounts use serial adapter IDs represented as strings by existing domain fields. Each new account receives one related profile; old profiles are not attached by email.

Retain the public same-origin `/api/auth/*` interface in Next.js as transport. Server callers use a typed remote gateway. Preserve browser origins, secure cookie behaviour, multiple Set-Cookie headers, redirects and uncached session reads. No auth server, credential queries or auth schema migrations remain in Next.js. Application billing/contact/API tables remain application-owned.

The adapter cannot coexist with Users & Permissions. Remove the latter's runtime configuration, duplicate user relations and obsolete bootstrap/sync logic. Explicit public routes and core API-token authorization retain their existing access. Do not replace them with blanket `auth: false` on generated CRUD routes.

Store roles in the existing scoped Role Grants. Library and Team memberships and paid entitlements retain separate meanings. Reusable Strapi policies establish identity and enforce required capabilities, resource ownership, scope and fresh authentication. Policies load an actor once per request. Critical writes also recheck authority in their transaction; jobs/direct service calls cannot rely on route policies having run. Frontend session capabilities are a display projection.

Reset public accounts, profiles and approved account-owned beta records through an explicit one-shot operation. Preserve catalogue/editorial values, publication metadata, required attribution, referenced media, admin identities, service tokens and beta access. Consolidate old contribution history into a system baseline; new contributions produce normal history. Clear sandbox billing ownership and fence delayed old events before accepting new users. No automatic destructive reset at startup.

## Design review and required mitigations

| Failure scenario                                                 | Required mitigation and evidence                                                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local-looking browser URL is a production tunnel                 | Establish the actual listener/database environment before mutations; local acceptance uses the existing development database.                                                                          |
| Removing Users & Permissions opens CRUD endpoints                | Inventory routes/auth strategies; verify anonymous, read-token, service and denied-write cases before activation.                                                                                      |
| Repeated adapter filter fields lose a condition                  | Pinned dependency patch retains AND clauses; regression exercises both time bounds and an owner constraint. Reassess when upgrading upstream.                                                          |
| Concurrent requests reuse a token or bypass a rate limit         | Keep conditional update/delete predicates in one database mutation; test single-winner token consumption and counter guards. Strip Strapi metadata from adapter results and normalize int8 timestamps. |
| New serial IDs collide with old domain ownership                 | Clear all approved public-account references together; compare dependency inventory and refuse unknown references. Do not reset sequences casually after users begin registering.                      |
| Delayed payment events restore erased grants                     | Preserve a reset boundary/ignored provider-object manifest or equivalent provider fencing; replay old events in acceptance.                                                                            |
| A role policy grants too broadly                                 | Resolve the canonical resource and current locale/queue/library/Team scope; test mixed grants, expiry, self-review and cross-owner substitution.                                                       |
| Revocation races a policy check                                  | Keep transaction-time authority and workflow guards on sensitive writes.                                                                                                                               |
| Proxy changes cookie or callback behaviour                       | Test main/mobile hosts, each Set-Cookie header, OAuth state, origin checks, verification callbacks, refresh and logout through the real transport.                                                     |
| Proxy rate limiting trusts forged IP headers                     | Accept forwarding identity only from the configured trusted transport; test direct requests and forged headers.                                                                                        |
| Server-only Better Auth methods are assumed to be HTTP endpoints | Inventory API calls; implement narrowly authenticated internal operations where required, especially password confirmation and deletion.                                                               |
| Profile creation partially fails                                 | Idempotent provisioning and uniqueness; deny domain use until the related profile exists and repair without duplicates.                                                                                |
| Auth hooks become recursive across services                      | Local Strapi session/access/email lookup; explicit deletion coordination with application billing, with idempotent steps and failure states.                                                           |
| Old verification table contains application state                | Move mobile confirmation/rate-limit records to owned storage before retiring auth tables.                                                                                                              |
| Activity triggers/FKs retain old auth dependencies               | Replace or remove them explicitly; install user foreign keys for the adapter’s scalar account/session/passkey references and verify deletion cascades and retention.                                   |
| Schema generation exposes credentials or breaks numeric fields   | Inspect generated schemas, hidden/private fields, owner references and epoch-millisecond types; test the actual adapter against PostgreSQL.                                                            |
| Account reset removes content through relations                  | Explicit deletion order and manifest, retained-content hashes and media/reference checks; no blanket CASCADE.                                                                                          |
| History baseline changes publication semantics                   | Preserve publication dates and catalogue values; compare rendered history and subsequent edits.                                                                                                        |
| Cleanup deletes re-registered users on retry                     | Durable one-shot reset checkpoint, source-drift refusal and an explicit maintenance window.                                                                                                            |
| An image rollback is mistaken for a data rollback                | Recovery snapshot and tested matching-code/database restoration before reopening writes; forward recovery after new writes.                                                                            |

## Acceptance and consequences

Local acceptance must cover fresh signup, all login methods, profile settings/export/deletion, scoped moderation and review locks, staff/Team access, sandbox billing/API keys, notifications, discussions/rewards and mobile confirmation/live operations. Negative permission tests are required alongside successful flows. Type generation, relevant tests, typechecks, lint and release checks run sequentially with bounded resources.

This removes authentication ownership duplication and repeated controller plumbing. Application-specific policy rules remain explicit and testable. The dependency is beta, so its pinned source, patches and adapter behaviour are part of our maintenance responsibility. Production promotion follows the existing release acceptance process after local verification.

Public documentation and commits contain only generic architecture, code, synthetic fixtures and placeholder environment examples. Provider secrets, private operational inventories, real account mappings and recovery evidence stay outside Git.

## Local verification

The local reset passed a transactional rehearsal before application, with retained-table fingerprints unchanged. The durable checkpoint prevents a second reset. Fresh Google and Discord sign-ins returned to profile onboarding through the same-origin callback routes.

The PostgreSQL acceptance runner verifies password signup and email ownership, magic-link replay rejection, password-reset session revocation, profile/export/deletion, immediate scoped-role grant and revocation, anonymous and API-token permission boundaries, and concurrent single-consumer token/counter mutations. A synthetic WebAuthn device verifies registration/login, unsigned counters, origin/replay rejection and mobile identity confirmation; physical device prompts are not part of that automated check. The unit suites passed 2,192 Strapi tests and 3,953 UI tests. Skipped integration suites are not claimed as executed; they require their separately documented environments.

Production promotion remains separate. An application image rollback cannot undo this account reset; recovery needs the matching database snapshot and code. Private recovery and provider credentials are excluded from the public repository.

Strapi server/plugins/admin and Next.js production builds passed, along with both application typechecks, lint checks and the public-file/secret checks. The local provider credentials and development OAuth callback configuration do not constitute production provider setup.
