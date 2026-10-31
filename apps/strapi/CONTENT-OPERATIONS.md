# CMS content operations

Routine editorial and content changes target production unless the user specifies otherwise. Feature development, schema changes, test fixtures and import experiments target local explicitly. Publishing CMS text does not deploy application code.

## Environment selection and credentials

Use the operator-approved connection and a token scoped to the requested content actions. Local and production permissions are independent; a successful local request does not prove production access. Connection addresses, tunnel commands, credential arrangements and transport status belong in the private operator runbook.

Content helpers use private environment inputs such as `STRAPI_MCP_TOKEN`, `STRAPI_PRODUCTION_MCP_TOKEN` and `STRAPI_PRODUCTION_URL`. Never print values, put tokens in browser URLs or commit environment files. Do not enable a disabled transport, restart the CMS or expand permissions merely to complete a content update. Never silently fall back to local when production is unavailable.

## Updating pricing content

From the repository root:

```sh
# Production preview; no writes.
node apps/strapi/scripts/update-team-pricing.mjs

# Publish the reviewed production changes and verify them by reading back.
node apps/strapi/scripts/update-team-pricing.mjs --apply

# Correct just the existing Team API guide, preserving unrelated copy.
node apps/strapi/scripts/update-team-pricing.mjs --api-guide-only --apply

# Explicit local feature-development copy.
node apps/strapi/scripts/update-team-pricing.mjs --local --apply
```

The script checks for unpublished edits, preserves unrelated content and creates private backups and previews under `.scratch/pricing-rollout/`. It updates existing Knowledge guides in English, French and Czech, membership pricing/API terms, and the English Team API guide. It does not change permissions, enable purchases or restart services.

The production API guides distinguish closed-beta Stripe Test mode from live purchases. Update availability copy only after the deployed checkout passes owned acceptance. Existing published articles keep their section, links, author, media and other metadata.

The self-service Team rollout also corrects the existing Team, staff-area and
account-deletion guides in English, French and Czech. It keeps detailed pricing
in the canonical plans and Team guides, removes obsolete copies from related
articles, and explains organisation ownership, seat changes and Organiser
handover. General terms record the descriptive changes as version 1.1; Team
membership, privacy and cancellation changes use version 1.2. The single-Team refinement records membership document revision 1.3, describing
one Team per account and unlimited API keys with one shared allowance. Cancellation document revision 1.3 updates its Team billing link. These are
descriptive document revisions; personal/API offer consent stays at 1.1 and the
annual Team offer at 1.2 because prices and settled purchase evidence are unchanged.
Historical accepted purchase versions remain unchanged; new accounts record general terms
version 1.1 without rewriting existing account consent. Preserve the published versions
while staging production drafts until the matching application release passes
acceptance. When local MCP is explicitly requested, use its discovered content
tools and publish/read back there; production continues to use private REST.

## Team API onboarding guides

The signup walkthrough and request reference live in the production Knowledge Data & API section, linked from the existing API, Team and plans articles.

```sh
# Preview the English onboarding/reference guides and related corrections.
node apps/strapi/scripts/update-team-api-guides.mjs

# Publish and verify content, relations and preserved editorial metadata.
node apps/strapi/scripts/update-team-api-guides.mjs --apply
```

Use `--local` explicitly for development. Private previews and backups stay under ignored `.scratch/team-api-guides/`. The helper refuses unpublished edits and concurrent changes. It does not provision Teams, create keys, contact testers, change billing flags or deploy code.

The current rollout includes a beta-verification notice. Sandbox checkout and settled-payment activation have passed owned testing; the copy must not describe checkout as blocked. Keep the qualification in `team-api-knowledge-content.mjs` until dashboard-created key, real request and usage acceptance also pass. Keep Stripe Test mode and live availability separate. A source regression test or synthetic paid fixture does not prove provider checkout or complete API acceptance.

The older `update-billing-docs.mjs` script remains a local feature migration. It now preserves the current Team pricing section; use an explicit reviewed production update for editorial work.

## Discussion guide rollout

The community publishing release updates existing guides in English, French and Czech and adds one localized conversation guide. Detailed membership instructions belong in the plans and Team guides; other guides link to them. The pricing helper preserves that separation.

```sh
# Read production and save a private preview; no CMS writes.
node apps/strapi/scripts/update-discussions-guides.mjs

# Save reviewed private drafts, preserving current publications and metadata.
node apps/strapi/scripts/update-discussions-guides.mjs --stage

# Resume or verify the saved staging checkpoint after an interrupted operation.
node apps/strapi/scripts/update-discussions-guides.mjs --resume-stage

# After the matching feature release passes production acceptance, publish
# only the staged versions and verify each publication by reading it back.
node apps/strapi/scripts/update-discussions-guides.mjs --publish
```

Use `--local` explicitly for local development. Backups, previews and staging checkpoints stay under ignored `.scratch/discussions-guide-rollout/`. The script refuses unrelated drafts or content changed after staging. All three translations of the new guide share one document identity. Publication is separate from staging so the live guides do not advertise features before deployment.

## Atlas guides and Journal roundup

`atlas-knowledge-content.mjs` contains the reviewed Reach, population/context and partial-record guides, the Atlas roundup and corrections for existing English, French and Czech guides. The roundup uses the author's supplied Reddit examples; retain image credit, alt text and the population/routing source notes.

```sh
# Read production and save a private preview.
node apps/strapi/scripts/update-atlas-guides.mjs

# Correct already-deployed features and publish the guides/roundup.
node apps/strapi/scripts/update-atlas-guides.mjs --publish-current

# Stage expanded-capacity copy while preserving current publications.
node apps/strapi/scripts/update-atlas-guides.mjs --stage

# Only after the matching application release passes acceptance.
ATLAS_CAPACITY_RELEASE_ACCEPTED=true node apps/strapi/scripts/update-atlas-guides.mjs --publish-staged
```

Use `--local` explicitly for feature fixtures. `CMS_ENV_FILE` can select a private credential file. `ATLAS_IMAGE_FILES_JSON` accepts the two locally inspected author-supplied screenshots for an initial publication; media IDs are checkpointed to avoid duplicate uploads. Backups, previews and staging checkpoints remain under ignored `.scratch/atlas-guides/`. The helper refuses unrelated drafts and changed staged content. Publishing content does not deploy native calculation code or enable billing. Expanded-capacity descriptions stay staged until the UI, CMS and native images agree and the release is accepted.

## Dashboard guide corrections

`dashboard-guide-content.mjs` updates navigation instructions, the profile
panel, separate moderation workspace, library sections, network filters and
Journal source fields in existing English, French and Czech guides. The helper
reads the full Knowledge catalogue and changes only affected bodies. It refuses
unrelated drafts, saves private before-images and verifies that metadata and
current publications stay unchanged.

```sh
# Preview production without writes, using the existing editorial connection.
node apps/strapi/scripts/update-dashboard-guides.mjs

# Stage reviewed corrections as private production drafts. This never publishes.
node apps/strapi/scripts/update-dashboard-guides.mjs --stage
```

`CMS_ENV_FILE` may select the existing private editorial credential file. If the
connection is unavailable, leave production untouched. Local audit snapshots can
produce a review-only preview with `--offline-preview`; this is not production
verification and cannot stage changes. Publish the reviewed drafts only with the
matching dashboard release. The new search guide has separate release copy in
`apps/docs/docs/proposals/site-search-knowledge-article.md`.

## Homepage refresh

The discovery-led homepage reuses the existing Homepage single type. Hero,
featured intro, Atlas, contribution, Journal and closing copy retain their own
fields. The **Content** title/text/CTA fields introduce the library staff section.
**Journeys** with tone `steward` supply its tool rows; their title, text and CTA
URL are the row label, access label and destination. **Open links** supply the
four source, review, coverage and reuse notes. Pillar institution cards come
from published Libraries with `featured` enabled, independently of the old
homepage featured-library relation. The carousel includes up to 36 institutions
in name order and loops manually, with two full cards and neighbouring card
previews on desktop (one full card on narrow screens). Names remain visible;
summaries and hours reveal on hover or keyboard focus and stay visible on touch
devices. It never advances automatically.

The contribution section uses the existing community band and numbered steps.
Its manual carousel shows up to six published open drives: featured first,
then pinned, then other open work in the public list’s order. It loads live
progress only for that selection and falls back to incomplete-library tasks
when no drives are open. Account-aware registration and contribution actions
are UI copy; the homepage does not create accounts or join drives on a visitor’s
behalf.

```sh
# Explicit local feature development: preview, then publish and read back.
node --experimental-strip-types apps/strapi/scripts/update-homepage-content.mjs --local
node --experimental-strip-types apps/strapi/scripts/update-homepage-content.mjs --local --publish-local

# Production: preview or stage drafts with the matching UI release.
node --experimental-strip-types apps/strapi/scripts/update-homepage-content.mjs
node --experimental-strip-types apps/strapi/scripts/update-homepage-content.mjs --stage
```

The helper covers English, French and Czech, preserves SEO, media and existing
relations, and refuses unrelated drafts or concurrent changes. Private backups,
previews and resumable checkpoints stay in ignored `.scratch/homepage-rebuild/`.
Production publication remains a separate editorial action after the matching
UI release is accepted. No permissions, subscriptions or service settings change.

The follow-up homepage pass restores the original open-data/open-source eyebrow.
The hero, Atlas, contribution and closing titles retain accent markup; other CMS titles are plain text, with
the Atlas and closing banners styled through shared display roles in the UI.
The helper clears unused journey-intro, coverage, events, Knowledge-band,
closing-benefit and open-intro copy, without deleting schema fields or curated
relations. Public homepage reads populate only the sections currently rendered.

Use `--atlas-only` with the homepage helper to update just the Atlas headline
and description while preserving its CTA labels, destinations and other homepage
content. Intentional Atlas title emphasis uses the same `*accent*` syntax as the
hero.

Use `--contribution-only` to update just the contribution headline and description,
preserving its CTA labels, destinations, numbered steps and other homepage content.

Use `--knowledge-only` to update only the curated Knowledge guide links. The eight
entries cover discovery, reading a record, adding a library, review, staff claims,
the Atlas, coverage and data reuse.

Use `--closing-only` to restore the closing headline accent while preserving its
description, CTA labels, destinations and other homepage content.
