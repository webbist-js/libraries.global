# Security regression checks

Use controlled synthetic accounts and records. Reuse the existing local services for routine checks; suites that require disposable databases or schemas belong in an approved isolated CI/acceptance environment. Run finite checks sequentially with bounded Node memory and one worker.

This checklist records invariants, not a past acceptance result. Keep account identifiers, session state, exploit captures, SQL changes, cleanup records and go/no-go decisions in private acceptance storage. Report suspected vulnerabilities through the root [security policy](../../../SECURITY.md).

## Identity and authority

- Dedicated account routes resolve the server session and construct trusted bridge identity. Caller-supplied user IDs, roles, prices and entitlement limits do not establish authority.
- Strapi checks current grants, moderation queue/language and library affiliation independently. Payment does not grant community review or library staff authority.
- Another account's drafts, submissions, billing attempts and private activity remain inaccessible. Sign-out, account switching and revoked grants clear private cached UI state.
- Session and public response projections omit service secrets, provider credentials and session tokens.

## Submission and publication

- Submitted review payloads are immutable. A stale revision or competing review returns a conflict instead of overwriting newer content.
- A reviewer cannot use a changed payload to redirect an accepted edit to another target. Self-review and insufficiently scoped review are refused.
- Repeated approval does not apply content or award points twice. Staff direct publication preserves its audit trail and awards no contribution points.
- Public reads return allowed published records, even when a caller supplies draft parameters. Applying an approved change does not publish unrelated administrator drafts.
- Hidden profiles and activity preferences remove private attribution from public lists, counts and notifications. Account erasure does not permit delayed requests to recreate private attribution.

## Request and upload boundaries

- Generic proxies reject unlisted operations, path traversal and arbitrary account/authentication writes. Dedicated mutations check origin, input schema and bounded bodies.
- Contribution and upload quotas are enforced by the authoritative service. Competing uploads share the durable account budget; an unavailable quota service refuses the upload.
- Upload completion and content publication verify ownership. Failed storage/confirmation cleanup cannot delete an already completed or owned file.

## Billing and recovery

- A checkout return, unpaid invoice or synthetic event cannot grant paid tools. Settled access remains bound to its owned customer/subscription and environment.
- Replay, out-of-order events, provider/CMS outages and account erasure preserve durable recovery and deduplicated notices.
- Recovery exports and user-facing errors omit payment capability URLs, signing secrets and unrelated financial records.

Use the focused tests beside the affected implementation, followed by the applicable [browser acceptance](../playwright/README.md). See the current [authentication boundary](../../../apps/docs/docs/authentication.md), [upload contract](../../../apps/docs/docs/uploads.md) and [billing implementation](../../../apps/ui/BILLING.md).
