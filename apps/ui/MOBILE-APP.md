# Mobile library console

With `MOBILE_APP_URL=https://mobile.libraries.global`, the application serves the console on that public origin. A vehicle opens at
`/<library-document-id>`, or `/cs/<library-document-id>` and
`/fr/<library-document-id>` for translated UI. The main site keeps public
library pages, timetables, staff settings and account management.

Set `MOBILE_APP_URL=https://mobile.libraries.global` in both the UI and Strapi
runtime environments. `APP_PUBLIC_URL` stays `https://libraries.global`.
The UI validates that the mobile origin is the `mobile` child of that account
domain and uses HTTPS. No runtime values need to be baked into an image.
With the setting absent, local development continues to use `/live`.

When that mobile origin is configured, the main site returns 404 for `/live` and its locale
variants. There are no compatibility redirects or installed-app migrations in this implementation. Account for existing installations before changing the origin.

## Accounts and access

Sign-in runs on the main site through `/auth/mobile?next=...`. Password,
Google, email links and onboarding keep their existing callbacks. Only console
paths can be used as mobile return destinations.

The Better Auth session cookie is named
`__Secure-libraries-shared.session_token` on HTTPS. It is HttpOnly and shared
within `libraries.global`; existing host-only sessions require a fresh sign-in
when this setting is first enabled. OAuth state and passkey challenge cookies
remain host-only. Both exact origins are trusted; wildcard origins are not
enabled. The passkey relying party remains the account domain and accepts
assertions from both origins. The 12-hour live confirmation cookie stays
host-only and bound to the authenticated session.

During beta, the main site copies a verified browser grant to an HttpOnly,
Secure `lg-mobile-beta-access` cookie for the parent domain. Its expiry cannot
exceed the original grant. Mobile requests still check invitation revocation
in the CMS. The beta gate and staff permissions remain active.

Only console pages, their static assets, live APIs, session reads/sign-out and
passkey authentication are served on the mobile host. Other application pages
and APIs return 404 there. Live writes must match the request host's exact
configured origin. The console has its nonce CSP, no-store, noindex and
geolocation restrictions; public-site tracking, notifications and feedback
controls are omitted.

## Domain and release

The mobile origin needs HTTPS and routing to the accepted UI runtime. DNS provider settings, gateway listeners, certificate installation and rollout commands belong in the private operator runbook. This document describes the application contract; it does not establish that a host is configured or accepted.

Feature PRs merge into `dev`. Production promotion follows a separately
scheduled, reviewed merge into `main`. Authentication and CMS changes require
the host's backup, isolated-data and rollback acceptance record before the
release agent can promote the images. Keep private host configuration,
credentials and acceptance evidence in the operator runbook, outside Git.

Acceptance covers both origins, beta and account sign-in, staff permissions,
password/email/passkey confirmation, start/check-in/end, localized navigation,
QR/email links, manifest scope and service-worker registration. Verify that
main-site `/live` returns 404 and unrelated mobile paths return 404. The mobile
manifest has a stable root identity, root scope and a locale-specific start URL.
