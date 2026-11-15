# Public launch

The release candidate retires closed-beta access. Old `/beta` links redirect to
validated local destinations. Invitation redemption and waitlist collection return 410. The CMS invitation plugin is disabled and queued invitation emails are skipped.
Stale beta flags cannot close frontend access. Public search retains rate limits
and server-only credentials. Account and staff authorization remain enforced.

The CMS origin protection is renamed `content-origin` and requires server
credentials independently of beta flags. Historical invitation records are retained.

## Cutover requirements

Deployment alone does not complete the launch:

1. Complete release review, exact-commit checks, host-only backup, isolated restore
   and rollback acceptance using `scripts/release/README.md`.
2. Prepare and rehearse a current-schema frontend-account reset with an explicit
   scope and retained-content fingerprints. Preserve CMS administrators, API
   tokens, accepted content, media and provenance. The old go-live cleanup and
   one-shot legacy auth reset are not reusable current-account reset procedures.
3. Complete sandbox acceptance, live catalogue/tax decisions, mode-matched
   webhooks, checkout and settlement using `apps/ui/PRICING.md` and `BILLING.md`.
   Never reuse sandbox customer or subscription bindings in live mode.
4. Publish and read back matching analytics notices and reviewed GTM configuration.
   Verify refused consent, grant, withdrawal and sanitized events in production
   reporting using `apps/ui/ANALYTICS.md`.
5. Stop and disable the beta invitation timer; remove retired gate/signing runtime
   variables. Configure the gateway for the application upstream. The historical
   `WEB_MODE=public` value is a maintenance fallback, not a public application mode.
6. Apply the rehearsed reset during maintenance and promote the accepted release.
   Refresh affected search/Atlas projections. Verify anonymous browsing, signup,
   email and providers, private authorization, robots/sitemaps, billing, analytics,
   service health and remaining scheduled jobs before declaring the launch complete.

Keep operational evidence and account inventories private. Prepared code and
catalogue objects do not prove production settlement or analytics collection.
