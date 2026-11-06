---
title: "Draft: privacy (legal review)"
description: "Draft revision of /legal/privacy for the sponsored-access model. Requires legal review before publication."
---

# Draft: /legal/privacy

**Status:** draft for legal review, prepared 2026-11-06. Not in force. Do not publish until legal review and the matching release acceptance are complete.

CMS document: `privacy` (English). Revision: next major. Mode: replaces or adds the sections below; other published sections are kept, with retired paid-plan sentences removed. Staged by `apps/strapi/scripts/update-sponsored-access-content.mjs --stage`; generated from `apps/strapi/scripts/sponsored-access-legal-content.mjs`. Edit the script, not this file.

Revision summary: DRAFT for legal review. Explains API billing references, usage events, submitted payloads, analysis job retention, recognition counters, sponsor records and analytics for access journeys. Withdrawn membership and Team billing processing removed.

## Draft for legal review – not in force

_In short: This revision has not been legally reviewed or published._

This draft revision was prepared on 2026-11-06 for legal review. It is not in force. The currently published version remains the governing text until a reviewed revision is published with the matching release.

Remove this section only after legal review and release acceptance. Text in square brackets must be confirmed or replaced before publication.

## API billing and payment information

_Replaces the published section “Membership and payment information”._

_In short: Private billing references support API subscriptions; card details stay with Stripe._

When an organiser buys API access, we share the organisation's name, the organiser's name and verified email and a private reference with Stripe to bind the purchase. Stripe's hosted checkout collects payment and billing information under its own terms. We store minimal customer, checkout, subscription and invoice references, the accepted terms and overage versions, the offer snapshot, overage cap changes, payment status and reconciliation results. We use them to provide the service, invoice usage, handle support and prevent duplicate charges. We do not receive or store full card numbers or CVCs. Minimal billing references are kept for six years after an account or API account is closed, for tax and accounting.

## API keys and usage records

_Replaces the published section “Team API keys and usage”._

_In short: Usage records support allowances and invoices; they do not contain your requests' content._

For each key we store its organisation, a digest and display prefix, scopes, expiry, creator and the audit of creation, regeneration and revocation. The full key is shown once and not retained. For each settled request or completed job we keep an immutable usage event: organisation and key reference, endpoint category, time, outcome, response size and analysis credits. Usage quantities are sent to Stripe for invoicing, identified by the organisation's billing reference. Detailed usage records are kept for 90 days; period totals, invoices and key audit events are kept longer for billing and security. Usage records do not contain search text, request bodies, IP addresses or raw keys.

## API submissions and analysis jobs

_New section._

_In short: Proposals join the moderation record; job results expire._

Proposals sent through the API are stored like other submissions: the proposed data, evidence and sources, the submitting API account, an idempotency key and the review history. They are kept as part of the moderation and change history after a decision. Analysis job inputs and results are kept for [retention period — confirm before publication] after completion and then deleted; job metadata needed for billing and abuse prevention is kept with usage records. Do not include personal data in proposals unless it is the public contact information of a library.

## Recognition records

_New section._

_In short: We count accepted contributions to show recognition._

Your profile stores the number of accepted contributions, the time of the latest one and whether a moderator revoked recognition. We use them to show Contributor and Supporter status and recent activity. Public display follows your profile privacy choices.

## Sponsors

_New section._

_In short: Sponsor records are kept separately from accounts._

For sponsorship we keep the organisation's details, contacts, agreement and term, recognition consent, logo and acknowledgement text. They are used to manage the agreement and publish acknowledgements only with consent. They never affect entitlements, ranking or moderation.

## Analytics for access and the API

_New section._

_In short: Optional analytics stay optional._

With your analytics consent, we measure steps such as creating an account, an accepted contribution, staff verification, API checkout, key creation, endpoint use, quota warnings, overage changes and sponsorship enquiries, to understand whether the service works. These measurements never include API keys, request bodies, proposal content or payment details. Without consent, no optional analytics are collected; essential server records described above are separate. [Confirm event list and retention against the cookie policy.]
