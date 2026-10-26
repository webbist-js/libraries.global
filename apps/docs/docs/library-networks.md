---
title: Library Networks
description: Public institutional groupings, employment affiliations and reviewed service management.
---

# Library Networks

A Library Network is a sourced grouping of libraries. It is separate from a Team subscription, a person's institutional affiliation and permission to edit a library record. Library services, university systems and consortia retain their own labels; membership does not assert ownership.

## Public discovery

`/library-networks` lists reviewed public pages, with name, country, region and kind filters. `/library-networks/{slug}` is the canonical page, including multinational networks. It shows published member records, a map and list, provenance, institutional links and entry points for affiliation, management and Team setup.

`/{continent}/{country}/library-services` is a geographic directory. Its `/{slug}` aliases redirect to the global canonical page only when the network belongs to that country. `library-services` is reserved against new Region slugs. Library detail pages show reviewed memberships under “Part of”.

An editor enables `publicPageEnabled` on the existing Library Network collection. The lifecycle records `publicPageReviewedAt`. Imported networks remain available to authenticated selectors and Atlas without automatically acquiring an endorsed public page. Existing records are not bulk-published by a code deployment. Before release, check existing Region slugs for a conflict with the new geographic hub.

## Affiliation and management

Profile settings and onboarding support declared network affiliations, optional public display, verified employment and withdrawal. Changing a verified job description returns the affiliation to declared status. The public profile also has to be public before an opted-in affiliation is displayed. Service claims are excluded from the public contribution activity feed.

`/staff/networks` creates one `network_claim` Submission with a frozen source membership revision and requested library IDs. Employment verification grants no branch authority. Management requests are available for operating services and university systems; a consortium relationship alone cannot grant branch management.

Moderators use the existing index queue and self-review checks. The service panel compares the frozen request with current membership, supports a subset decision and requires a reason for partial approval. Editor access is the default. Requested owner responsibility requires a separate explicit approval and reason; only those approved libraries support Team delegation. New source additions require another grouped review, as agreed. Source removals require a recorded reconciliation decision.

A needs-info request is resubmitted as the same case with a fresh frozen snapshot and review history. One case earns at most one ordinary claim award. Review approval and access fulfilment have separate states.

## Grants and fulfilment

The access plugin owns private `network-affiliation`, `network-mandate`, `network-mandate-event` and `library-authority-grant` collections. Approved Submissions and append-only mandate events retain each review scope and subsequent reconciliation. A mandate records its current approved library IDs, owner/delegation subset, source snapshot, revision, beneficiary, optional represented Team and fulfilment checkpoint.

A grant ledger records independent claim, Team and network origins. Existing affiliations acquire provenance lazily before a writer changes them. Effective library affiliations project the strongest remaining permission. Revoking a service mandate or Team assignment preserves independently valid claims and grants. An individual removal also cancels that beneficiary's pending service grant at the library. An approved institutional Team delegation scope remains a separate mandate; changing one person's library role does not edit that institutional scope.

Grant creation and revocation share the source mandate lock. Each library grant and its fulfilment checkpoint commit atomically. Retries are idempotent and failures remain visible. Batches contain at most 25 libraries. A leader-elected cron attempts a due batch every ten seconds; an authorised retry action can also resume one batch. Revoked mandates are rejected at current authority checks while their physical removal batches finish. Bulk work uses one case notification rather than a message for every library.

The service workspace shows approved scope, pending work, later additions and source removals. `/staff/networks/libraries` pages through current staff records. Sessions retain the existing 100-library summary bound; an individual staff page outside that summary resolves its target authority from Strapi. Team coverage supports up to 2,000 library identities, without expanding the session's staff-permission payload.

## Teams and widgets

Team setup starts with a network choice and a preview of its published library count. An existing verified affiliation can supply a suggestion; the organiser confirms it. Manual selection remains available. Team setup selects the service's current libraries as coverage and stores its primary network for widget defaults. Existing Team members are sent to their current Team, preserving the selected network.

Connecting an existing Team requires a separate confirmation before adding current network libraries to coverage. It retains existing coverage. Verified Teams retain the existing owner checks for newly covered libraries. A reference connection grants no staff permissions. A reviewed owner/delegation mandate permits explicit staff assignments only within its approved scope. A Team lapse disables paid tools without erasing legitimate branch authority.

Several Teams may reference the same public network. This release does not infer an exclusive official Team from that reference. Management representation is recorded on each reviewed mandate, with its beneficiary, Team and library subset visible to moderators. Changing a mandate's represented Team requires another review; a client cannot rebind approved authority by connecting a different network reference.

Public widgets can follow current network membership even while staff additions await review. See [Team widgets](team-widgets.md).

## Boundaries and verification

Next.js resolves the Better Auth identity, allows only known operations and fields, rate-limits requests and checks same-origin writes. Strapi verifies the server bridge and re-reads authority. Dedicated public projections omit account identities, claim evidence and private mandates. Account erasure withdraws service authority, redacts private case evidence and removes affiliation and grant identities; queued derived-access removals can finish against the anonymised mandate.

Engineering limits are 2,000 libraries per managed scope, ten profile affiliations, five open service cases per person and 25 libraries per fulfilment batch. Oversized scopes fail explicitly. Build affected plugins before generating Strapi types, because schema generation reads their compiled exports.

Tests cover grouped review, self-review, subset scope, owner delegation, new and removed members, retries, partial fulfilment, revocation before batch completion, independent grant origins, account erasure, public privacy and staff access beyond the session summary. Local browser checks reuse the existing database and a single application stack. General release and operational acceptance requirements still apply.

The opt-in `qa/tests/playwright/e2e/access/networks.spec.ts` exercises public discovery, grouped owner review, partial approval, needs-info resubmission and Team connection against real Strapi storage. After the ordinary access fixtures exist, stop the local HTTP Strapi process and run `node ../../qa/tests/playwright/helpers/strapi-networks-writer.cjs` from `apps/strapi` with the existing local database configuration. Restart the same application stack, then run `pnpm --filter @repo/tests-playwright exec playwright test --project=access e2e/access/networks.spec.ts --workers=1`. The writer refuses production and remote databases; the tests withdraw their fixture authority and restore the fixture Team's coverage and network reference.
