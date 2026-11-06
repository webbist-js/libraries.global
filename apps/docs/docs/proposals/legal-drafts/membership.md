---
title: "Draft: API purchase terms (legal review)"
description: "Draft revision of /legal/membership for the sponsored-access model. Requires legal review before publication."
---

# Draft: API purchase terms

**Status:** draft for legal review, prepared 2026-11-06. Not in force. Do not publish until legal review and the matching release acceptance are complete.

CMS document: `membership` (English). Revision: next major. Mode: replaces the whole document. Staged by `apps/strapi/scripts/update-sponsored-access-content.mjs --stage`; generated from `apps/strapi/scripts/sponsored-access-legal-content.mjs`. Edit the script, not this file.

Revision summary: DRAFT for legal review. Replaces the withdrawn personal membership, Team seat and earlier API terms with the £100/month API purchase terms (offer version 2.0) and capped overage terms (version 2.0).

Lead: Terms for buying and using paid API access to Libraries Global, including allowances, capped overage, renewal and cancellation.

Summary points:

- Library facts, accounts, contributions and staff tools are free. Only API access and sponsorship are paid.
- API access costs £100 a month including tax at the base GBP price. Stripe confirms the final charge before you pay.
- Overage is off unless an organiser switches it on and sets a monthly cap.

## Draft for legal review – not in force

_In short: This revision has not been legally reviewed or published._

This draft revision was prepared on 2026-11-06 for legal review. It is not in force. The currently published version remains the governing text until a reviewed revision is published with the matching release.

Remove this section only after legal review and release acceptance. Text in square brackets must be confirmed or replaced before publication.

## The service and operator

_In short: Libraries Global sells API access; Stripe handles the payment transaction._

Libraries Global is operated by Alexander Bennett. These API purchase terms supplement the [general terms of use](/legal/terms). Contact for API access, billing and cancellation: info@libraries.global. Legal notices: legal@libraries.global. Postal contact: [Postal contact address — confirm before publication]

The operator named above is the seller and supplier of API access. Stripe Managed Payments, provided by Sold through Link, LLC or its affiliates, acts as merchant of record for the payment transaction. We remain responsible for the API service and our obligations to customers. Stripe handles payment processing, applicable indirect taxes, financial confirmations and transaction support under the Link terms shown at checkout.

These terms are offer version 2.0. The version you accept is recorded with your purchase.

## What you buy

_In short: A monthly API subscription for one organisation._

API access gives software versioned access to published library information through keys. It is bought for an organisation on Libraries Global. If you buy as an individual, a single-member organisation is created for you at checkout. An organisation can hold one active API subscription. You must be at least 18 and, when buying for an organisation, authorised to accept these terms on its behalf.

Organisers manage billing, keys and overage settings. Members can view usage. Some API features, such as service data, submissions and analysis, are introduced in stages; the developer pages show which are available to your account. A feature that is not yet available is not part of what you have paid for.

API access never grants staff verification, library editing rights, moderation, access to other people's accounts or private data, or any editorial priority.

## Price, tax and renewal

_In short: £100 a month, including tax at the base GBP price._

API access costs £100 a month. This GBP price includes applicable tax. Stripe confirms the final tax, any local currency and the recurring total before you pay, and the invoice shows the actual charge. The subscription renews monthly until an organiser cancels it.

We will not change the price of an existing subscription without telling the organisers before the change affects a renewal. [Confirm notice period with legal review.]

## Billing period and allowances

_In short: Allowances follow your paid period, not the calendar month._

Each billing period runs from the start time of your paid subscription period up to, but not including, its end time, in UTC. Each period includes:

- 10,000 successful requests
- 250 MiB (262,144,000 bytes) of uncompressed JSON response data
- 100 analysis credits

The allowances are shared across all of the organisation's keys and applications. A first, partial period receives the full allowances. A new period's allowances start only when that period's payment has settled; a failed or pending payment does not create new usage. Unused allowances do not roll over. Creating or regenerating keys never adds to or resets an allowance. The allowances, limits and rates shown at checkout are recorded with your purchase and are not changed by later configuration.

## Rate limits and fair use

_In short: Limits protect a shared public service._

Your organisation can make up to 30 request attempts a minute and 2 concurrent requests. Responses are limited to 128 KiB and lists to 50 records a page. Requests beyond these limits are refused with a documented error.

Do not try to avoid metering or limits, for example by using browser routes instead of the API, sharing keys between organisations or sending requests through other accounts. We may limit or suspend access that does this, that threatens the service's security or availability, or that breaks the [general terms of use](/legal/terms).

## What is counted

_In short: Successful work counts; failed or refused work is never charged._

Each successful response counts as one request, and its uncompressed JSON size counts towards response data. This includes repeated requests and cached answers. Response data is measured before compression; it is not the hosting provider's network figure.

Analysis credits are spent only when a new analysis job completes: 1 credit for a simple summary, 5 for a richer summary, 5 for one-library Reach, 20 for service Reach and 40 for network Reach where it is offered. A cached identical result spends no credits, but delivering it counts as a request and response data. Fetching a completed result again never spends another credit.

We do not charge for failed, refused, timed-out or internally retried work. Failed attempts still count towards rate limits. Our application ledger decides in real time whether a request can proceed; Stripe's records are used for invoicing and are reconciled against that ledger.

## Capped overage

_In short: Optional, capped and switched on only by an organiser._

Overage is off by default. When it is off, a request or job that would exceed an included allowance is refused.

An organiser can switch overage on by accepting the overage terms (version 2.0) and choosing a monthly cap. Usage beyond the included allowances then costs 1p per request, 10p per MiB (1,048,576 bytes) of response data and 50p per analysis credit. These rates exclude tax; Stripe adds any applicable tax on the invoice. Data overage is calculated on the exact number of excess bytes. Each period's overage invoice line is rounded to the nearest penny.

The cap can be set from £10 to £500 in £10 steps. £100 may be suggested, but overage is never enabled without an organiser's affirmative choice. The cap applies to the combined request, data and credit overage for the billing period, before tax. A request or job whose maximum possible cost could take the overage past the cap is refused before it starts. Changes to the cap are recorded.

An organiser can lower the cap or switch overage off at any time. This stops further paid usage straight away but does not cancel overage already incurred, which remains payable. We send warnings at 50%, 80% and 100% of each allowance and of the cap. Overage is billed in arrears on the next invoice. There is never an uncapped overdraft or negative balance, including when Stripe confirmations are delayed.

## Starting access

_In short: Request immediate access without waiving statutory rights._

By accepting these terms and continuing to checkout, you ask for API access to start as soon as payment is confirmed. This request does not remove any statutory cancellation right. Access starts only after the matching invoice has settled; a checkout return page or an unpaid subscription grants nothing.

## Keys and security

_In short: Keys are secrets that belong to the organisation._

Organisers can create, regenerate and revoke keys. A full key is shown once; we store only a digest and a short prefix. Keep keys on servers and in secret storage. You are responsible for requests made with your keys until you revoke them. Regenerating a key stops the old value immediately. We may revoke a key that appears to be exposed or misused and will tell the organisers when we do.

## Submissions and analysis

_In short: Proposals are reviewed; analysis results are models._

Proposals sent through the API are untrusted suggestions. They enter the normal moderation process and may be accepted, changed or rejected. A key cannot act as a library's staff. By submitting, you confirm that you have the right to share the material, and you license accepted contributions under the [data licence](/legal/data-licence).

Analysis and Reach results are modelled estimates based on published records and third-party datasets. They do not measure visits, admission or step-free access, and they can be incomplete. Completed job results are kept for [retention period — confirm before publication] and then deleted.

## Suspension and ending access

_In short: We explain why access is limited or suspended._

We may limit or suspend API access for non-payment, abuse, security risks, breach of these terms or the general terms, or where the law requires it. Where it is safe and lawful, we tell the organisers why and how to resolve it. A payment grace period never authorises unbilled overage. Access ends when paid coverage ends, a full refund of the current period is made or a payment dispute is opened.

## Cancellation and refunds

_In short: Stopping renewal and asking for a refund are separate._

Organisers stop renewal from Developers → Manage API billing. Settled access continues to the end of the paid period. Overage already incurred stays payable. Read the [cancellation and refund policy](/legal/cancellation-refunds) for statutory cancellation rights, refunds and payment disputes.

## Attribution and source licences

_In short: Paid access does not change data licences._

Keep the attribution and source records returned with the data and follow the [data licence](/legal/data-licence) and any source-specific licence or redistribution restriction. A paid subscription does not grant rights that a source's licence does not.

## What payment never buys

_In short: Trust and editorial decisions are never for sale._

Payment never buys trust, search ranking, staff verification, moderation, recognition or editorial treatment. Sponsorship is a separate commercial agreement, not a charitable donation. It gives no influence over content and does not include API access unless a separate written arrangement says so.

## Beta service and earlier test offers

_In short: The closed beta uses test payments._

Libraries Global is in a closed beta. During the beta, checkout uses Stripe Test mode and no real payment is taken; live purchases start only when we announce them. Features can change or be unavailable. Personal membership, workspace seat and earlier API test subscriptions offered during the beta used test payments only. They have been withdrawn, and no rights carry over from them.

## Changes and governing law

_In short: New versions are recorded; earlier versions are kept._

We record each version of these terms. If we change them, the version you accepted continues to apply to your current period, and we tell organisers before a change affects a renewal. These terms are governed by the law of England and Wales. If you are a consumer, you keep the protection of mandatory laws where you live, and nothing in these terms limits your statutory rights.
