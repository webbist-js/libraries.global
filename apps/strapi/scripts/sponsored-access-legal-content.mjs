/**
 * Draft legal revisions for the access model in
 * apps/docs/docs/proposals/sponsored-access-decisions.md. Every draft carries
 * a "Draft for legal review" section and must be reviewed before publication.
 * Revisions are appended; accepted historical revision rows are never edited.
 * English only: legal locale coverage is decided after a production inventory.
 */
import {
  ACCESS,
  accessValues,
  markdownBlocks,
  scrubBlocks,
} from "./sponsored-access-content.mjs"

export const REVIEW_HEADING = "Draft for legal review – not in force"
/** Consent versions recorded by API checkout and overage opt-in. */
export const API_OFFER_TERMS_VERSION = "2.0"
export const API_OVERAGE_TERMS_VERSION = "2.0"

const section = (heading, inShort, markdown) => ({ heading, inShort, markdown })

function reviewSection(date) {
  return section(
    REVIEW_HEADING,
    "This revision has not been legally reviewed or published.",
    `This draft revision was prepared on ${date} for legal review. It is not in force. The currently published version remains the governing text until a reviewed revision is published with the matching release.

Remove this section only after legal review and release acceptance. Text in square brackets must be confirmed or replaced before publication.`
  )
}

/** The five revised documents. `mode: "replace"` rewrites the whole document. */
export function legalDrafts({
  operator = "Alexander Bennett",
  postalAddress = "[Postal contact address — confirm before publication]",
  contactEmail = "info@libraries.global",
  legalEmail = "legal@libraries.global",
} = {}) {
  const v = accessValues("en")
  const c = ACCESS.credits

  return [
    {
      slug: "membership",
      mode: "replace",
      summary: `Replaces the earlier beta test terms with the ${v.price}/month API purchase terms (offer version ${API_OFFER_TERMS_VERSION}) and capped overage terms (version ${API_OVERAGE_TERMS_VERSION}).`,
      metadata: {
        title: "API purchase terms",
        heroTitle: "API purchase *terms.*",
        navLabel: "API terms",
        lead: "Terms for buying and using paid API access to Libraries Global, including allowances, capped overage, renewal and cancellation.",
        summaryPoints: [
          {
            text: "Library facts, accounts, contributions and staff tools are free. Only API access and sponsorship are paid.",
          },
          {
            text: `API access costs ${v.price} a month including tax at the base GBP price. Stripe confirms the final charge before you pay.`,
          },
          {
            text: "Overage is off unless an organiser switches it on and sets a monthly cap.",
          },
        ],
      },
      sections: [
        section(
          "The service and operator",
          "Libraries Global sells API access; Stripe handles the payment transaction.",
          `Libraries Global is operated by ${operator}. These API purchase terms supplement the [general terms of use](/legal/terms). Contact for API access, billing and cancellation: ${contactEmail}. Legal notices: ${legalEmail}. Postal contact: ${postalAddress}

The operator named above is the seller and supplier of API access. Stripe Managed Payments, provided by Sold through Link, LLC or its affiliates, acts as merchant of record for the payment transaction. We remain responsible for the API service and our obligations to customers. Stripe handles payment processing, applicable indirect taxes, financial confirmations and transaction support under the Link terms shown at checkout.

These terms are offer version ${API_OFFER_TERMS_VERSION}. The version you accept is recorded with your purchase.`
        ),
        section(
          "What you buy",
          "A monthly API subscription for one organisation.",
          `API access gives software versioned access to published library information through keys. It is bought for an organisation on Libraries Global. If you buy as an individual, a single-member organisation is created for you at checkout. An organisation can hold one active API subscription. You must be at least 18 and, when buying for an organisation, authorised to accept these terms on its behalf.

Organisers manage billing, keys and overage settings. Members can view usage. Some API features, such as service data, submissions and analysis, are introduced in stages; the developer pages show which are available to your account. A feature that is not yet available is not part of what you have paid for.

API access never grants staff verification, library editing rights, moderation, access to other people's accounts or private data, or any editorial priority.`
        ),
        section(
          "Price, tax and renewal",
          `${v.price} a month, including tax at the base GBP price.`,
          `API access costs ${v.price} a month. This GBP price includes applicable tax. Stripe confirms the final tax, any local currency and the recurring total before you pay, and the invoice shows the actual charge. The subscription renews monthly until an organiser cancels it.

We will give organisers at least 30 days' notice before a price change affects their next renewal. They can cancel renewal before the new price takes effect. A change to an included allowance or overage rate will apply only after the same notice; the terms recorded with a purchase govern its current paid period.`
        ),
        section(
          "Billing period and allowances",
          "Allowances follow your paid period, not the calendar month.",
          `Each billing period runs from the start time of your paid subscription period up to, but not including, its end time, in UTC. Each period includes:

- ${v.requests} successful requests
- ${v.mib} (${v.bytes} bytes) of uncompressed JSON response data
- ${v.credits} analysis credits

The allowances are shared across all of the organisation's keys and applications. A first, partial period receives the full allowances. A new period's allowances start only when that period's payment has settled; a failed or pending payment does not create new usage. Unused allowances do not roll over. Creating or regenerating keys never adds to or resets an allowance. The allowances, limits and rates shown at checkout are recorded with your purchase and are not changed by later configuration.`
        ),
        section(
          "Rate limits and fair use",
          "Limits protect a shared public service.",
          `Your organisation can make up to ${v.attemptsPerMinute} request attempts a minute and ${v.concurrent} concurrent requests. Responses are limited to ${v.maxResponse} and lists to ${v.pageSize} records a page. Requests beyond these limits are refused with a documented error.

Do not try to avoid metering or limits, for example by using browser routes instead of the API, sharing keys between organisations or sending requests through other accounts. We may limit or suspend access that does this, that threatens the service's security or availability, or that breaks the [general terms of use](/legal/terms).`
        ),
        section(
          "What is counted",
          "Successful work counts; failed or refused work is never charged.",
          `Each successful response counts as one request, and its uncompressed JSON size counts towards response data. This includes repeated requests and cached answers. Response data is measured before compression; it is not the hosting provider's network figure.

Analysis credits are spent only when a new analysis job completes: ${c.summary} credit for a simple summary, ${c.richSummary} for a richer summary, ${c.library} for one-library Reach, ${c.service} for service Reach and ${c.network} for network Reach where it is offered. A cached identical result spends no credits, but delivering it counts as a request and response data. Fetching a completed result again never spends another credit.

We do not charge for failed, refused, timed-out or internally retried work. Failed attempts still count towards rate limits. Our application ledger decides in real time whether a request can proceed; Stripe's records are used for invoicing and are reconciled against that ledger.`
        ),
        section(
          "Capped overage",
          "Optional, capped and switched on only by an organiser.",
          `Overage is off by default. When it is off, a request or job that would exceed an included allowance is refused.

An organiser can switch overage on by accepting the overage terms (version ${API_OVERAGE_TERMS_VERSION}) and choosing a monthly cap. Usage beyond the included allowances then costs ${v.requestRate} per request, ${v.mibRate} per MiB (1,048,576 bytes) of response data and ${v.creditRate} per analysis credit. These rates exclude tax; Stripe adds any applicable tax on the invoice. Data overage is calculated on the exact number of excess bytes. Each period's overage invoice line is rounded to the nearest penny.

The cap can be set from ${v.capMin} to ${v.capMax} in ${v.capStep} steps. ${v.capDefault} may be suggested, but overage is never enabled without an organiser's affirmative choice. The cap applies to the combined request, data and credit overage for the billing period, before tax. A request or job whose maximum possible cost could take the overage past the cap is refused before it starts. Changes to the cap are recorded.

An organiser can lower the cap or switch overage off at any time. This stops further paid usage straight away but does not cancel overage already incurred, which remains payable. We send warnings at 50%, 80% and 100% of each allowance and of the cap. Overage is billed in arrears on the next invoice. There is never an uncapped overdraft or negative balance, including when Stripe confirmations are delayed.`
        ),
        section(
          "Starting access",
          "Request immediate access without waiving statutory rights.",
          "By accepting these terms and continuing to checkout, you ask for API access to start as soon as payment is confirmed. This request does not remove any statutory cancellation right. Access starts only after the matching invoice has settled; a checkout return page or an unpaid subscription grants nothing."
        ),
        section(
          "Keys and security",
          "Keys are secrets that belong to the organisation.",
          "Organisers can create, regenerate and revoke keys. A full key is shown once; we store only a digest and a short prefix. Keep keys on servers and in secret storage. You are responsible for requests made with your keys until you revoke them. Regenerating a key stops the old value immediately. We may revoke a key that appears to be exposed or misused and will tell the organisers when we do."
        ),
        section(
          "Submissions and analysis",
          "Proposals are reviewed; analysis results are models.",
          `Proposals sent through the API are untrusted suggestions. They enter the normal moderation process and may be accepted, changed or rejected. A key cannot act as a library's staff. By submitting, you confirm that you have the right to share the material, and you license accepted contributions under the [data licence](/legal/data-licence).

Analysis and Reach results are modelled estimates based on published records and third-party datasets. They do not measure visits, admission or step-free access, and they can be incomplete. Completed Reach results are kept for 24 hours and completed summary results for 15 minutes, then deleted. Pending jobs expire after 30 minutes; job inputs and metadata are kept for 30 days. Separate billing usage records follow the [privacy policy](/legal/privacy).`
        ),
        section(
          "Suspension and ending access",
          "We explain why access is limited or suspended.",
          "We may limit or suspend API access for non-payment, abuse, security risks, breach of these terms or the general terms, or where the law requires it. Where it is safe and lawful, we tell the organisers why and how to resolve it. A payment grace period never authorises unbilled overage. Access ends when paid coverage ends, a full refund of the current period is made or a payment dispute is opened."
        ),
        section(
          "Cancellation and refunds",
          "Stopping renewal and asking for a refund are separate.",
          "Organisers stop renewal from Developers → Manage API billing. Settled access continues to the end of the paid period. Overage already incurred stays payable. Read the [cancellation and refund policy](/legal/cancellation-refunds) for statutory cancellation rights, refunds and payment disputes."
        ),
        section(
          "Attribution and source licences",
          "Paid access does not change data licences.",
          "Keep the attribution and source records returned with the data and follow the [data licence](/legal/data-licence) and any source-specific licence or redistribution restriction. A paid subscription does not grant rights that a source's licence does not."
        ),
        section(
          "What payment never buys",
          "Trust and editorial decisions are never for sale.",
          "Payment never buys trust, search ranking, staff verification, moderation, recognition or editorial treatment. Sponsorship is a separate commercial agreement, not a charitable donation. It gives no influence over content and does not include API access unless a separate written arrangement says so."
        ),
        section(
          "Beta service and earlier test offers",
          "The closed beta uses test payments.",
          "Libraries Global is in a closed beta. During the beta, checkout uses Stripe Test mode and no real payment is taken; live purchases start only when we announce them. Features can change or be unavailable. Any earlier test subscriptions taken during the beta used test payments only; they have ended and no rights carry over from them."
        ),
        section(
          "Changes and governing law",
          "New versions are recorded; earlier versions are kept.",
          "We record each version of these terms. If we change them, the version you accepted continues to apply to your current period, and we tell organisers before a change affects a renewal. These terms are governed by the law of England and Wales. If you are a consumer, you keep the protection of mandatory laws where you live, and nothing in these terms limits your statutory rights."
        ),
      ],
    },
    {
      slug: "cancellation-refunds",
      mode: "replace",
      summary:
        "Rewritten for the monthly API subscription and capped overage. Statutory rights unchanged.",
      metadata: {
        title: "Cancellation and refunds",
        heroTitle: "Cancellation *and refunds.*",
        navLabel: "Cancellation & refunds",
        lead: "How to stop API renewal, request a refund and get payment help.",
        summaryPoints: [
          { text: "Organisers stop API renewal without deleting any account." },
          {
            text: "Settled access normally continues until the paid period ends.",
          },
          {
            text: "Statutory cancellation and consumer rights remain unchanged.",
          },
        ],
      },
      sections: [
        section(
          "Who to contact",
          `Send cancellation and refund requests to ${contactEmail}.`,
          `Libraries Global is operated by ${operator}, the seller and supplier of API access. Contact: ${contactEmail}. Postal contact: ${postalAddress}. Stripe Managed Payments acts as merchant of record for the payment transaction and provides transaction support through Link. This policy accompanies the [API purchase terms](/legal/membership).`
        ),
        section(
          "Stop future renewal",
          "Organisers use Developers → Manage API billing.",
          "An organiser signs in, opens Developers and chooses Manage API billing to cancel renewal in Stripe's billing page. You can also manage renewal through Link using your financial confirmation. You do not need to delete an account or contact us just to stop renewal. Check the effective date and keep the confirmation. Settled access normally continues to the end of the paid period."
        ),
        section(
          "Overage when you cancel",
          "Overage already used stays payable.",
          "If overage was switched on, overage incurred before cancellation remains payable and appears on the final invoice. To stop further overage at once, switch overage off or lower the cap. Doing so does not cancel overage already incurred."
        ),
        section(
          "Statutory cancellation rights",
          "UK consumers normally have 14 days to cancel.",
          `If you are a consumer in the UK buying online, the cancellation period normally ends 14 days after the day the contract is entered into. Tell us clearly before that period ends; no special form is required. Asking for access to start immediately does not remove this right, but a proportionate amount for the service already supplied may be deducted where the law allows. Other countries may give additional rights. Stopping renewal is separate from cancelling a purchase. The UK consumer cooling-off right does not generally apply when a buyer contracts wholly for business purposes. Business buyers can stop future renewal and request a refund under the transaction terms, this policy and any applicable law.`
        ),
        section(
          "Request a refund",
          "Use the transaction support route on your Stripe confirmation.",
          `Request a payment refund through Link's transaction support route shown on your financial confirmation, or tell us at ${contactEmail}. Include the invoice reference, account email, purchase date and your request. Our refund policy is subject to [Link's refund policy](https://support.link.com/questions/sold-through-link-refunds); Link's policy prevails if ours is more restrictive, and statutory rights are unaffected. This is not a promise of an unconditional refund for every purchase.`
        ),
        section(
          "Refund timing and method",
          "Statutory refunds follow the legal deadline and original payment method.",
          "For a valid UK statutory cancellation, reimbursement is due without undue delay and normally within 14 days of our being told, subject to any lawful deduction for service already supplied. The original payment method is used unless you agree otherwise, and no refund fee is charged. Your bank may take longer to show the funds. For other refund requests, Link's refund policy, the transaction terms and applicable law decide eligibility and timing."
        ),
        section(
          "Work we never charge for",
          "Failed or refused work is not billed.",
          "We do not charge allowances, analysis credits or overage for failed, refused, timed-out or internally retried work. If an invoice includes such a charge, contact us and we will correct it. A failed renewal payment does not open new usage."
        ),
        section(
          "What happens to access",
          "A refunded or disputed current period ends paid access.",
          "A full refund of the current paid period, or a payment dispute, ends API access for that period and stops its keys. Partial refunds and refunds of an earlier period do not remove a later settled period. Free accounts, contributions, recognition and verified staff tools are unaffected."
        ),
        section(
          "Sponsorship agreements",
          "Sponsorship follows its own agreement.",
          "Sponsorship is a separate written agreement. Its term, cancellation and any refund are set out in that agreement, not in this policy."
        ),
        section(
          "Model cancellation form",
          "Optional; you can write in your own words.",
          `You do not need this form to stop renewal. It is an optional way to exercise a statutory cancellation right.

To ${operator}, postal contact: ${postalAddress}; email: ${contactEmail}.

I give notice that I cancel my contract for the following service: [API access].

Ordered on: [date]. Name: [your name]. Address: [your address]. Account email and invoice reference: [details]. Date: [date]. Signature: [only if sent on paper].

Do not include a password, sign-in link, API key, full card number or CVC.`
        ),
        section(
          "If something goes wrong",
          "Check billing status before paying again.",
          `If a payment is uncertain or access is still confirming, check the billing page and your financial confirmation before paying again. Contact ${contactEmail} for access problems. For unresolved transaction issues, use Link's support process. You can read the [UK Consumer Contracts Regulations](https://www.legislation.gov.uk/uksi/2013/3134). Your statutory remedies are unaffected.`
        ),
      ],
    },
    {
      slug: "terms",
      mode: "merge",
      summary:
        "Describes free Explorer accounts, earned Contributor and Supporter recognition, free verified staff tools, the paid API, API submissions, sponsorship and the beta. Withdrawn paid-plan and earned-access wording removed.",
      replace: {
        "Donations and paid features": section(
          "Free access and paid services",
          "Library facts and participation are free; only the API and sponsorship are paid.",
          `Reading and searching library records, using the Atlas, holding a free account, contributing and using verified staff tools are free. Free accounts have fair-use limits, such as on exports and saved items, shown where they apply.

Paid API access is sold under the [API purchase terms](/legal/membership). Sponsorship is a separate commercial agreement; it is not a charitable donation and gives no influence over records, ranking, verification or editorial decisions. Payment, sponsorship and recognition never grant trust, a community role, moderation or staff authority.`
        ),
        "Points, tiers and badges": section(
          "Points, badges and recognition",
          "Recognition thanks accepted work; it grants no authority.",
          `Accepted contributions earn points, tiers and badges. Tiers adjust contribution limits only. Your first accepted contribution gives Contributor status, which includes a small Atlas Reach allowance; ${ACCESS.supporterThreshold} accepted contributions give Supporter recognition. We count accepted submissions and suggestions, not points. Administrative adjustments, streaks and automatic bonuses do not count.

Points, badges and recognition have no monetary value and cannot be transferred or exchanged. Moderators can revoke recognition for fraudulent or duplicated contributions. Recognition never grants editing rights, staff verification, moderation or API access.`
        ),
      },
      add: [
        section(
          "Automated access and the API",
          "Software uses the API with a key and within its limits.",
          "Automated access should use the API with a valid key, within its published limits. Do not use browser routes, shared accounts or other methods to avoid API metering, limits or charges. A key authenticates software only; it does not identify a person or carry staff authority. We may limit or suspend automated access that breaks these terms or threatens the service."
        ),
        section(
          "Proposals through the API",
          "API submissions are reviewed like any suggestion.",
          "Proposals sent through the API are untrusted suggestions that go through moderation. They are never published directly, do not earn points or recognition for the API account and cannot claim to act for a library's staff. Accepted contributions are published under the data licence. Only submit material you have the right to share."
        ),
        section(
          "Sponsorship",
          "Sponsors fund the service without influencing it.",
          "Organisations can sponsor Libraries Global under a separate written agreement. With the sponsor's consent we acknowledge it publicly. Sponsorship gives no influence over library records, search results, verification, moderation or editorial decisions, and does not include API access unless agreed separately."
        ),
        section(
          "Beta service",
          "The service is in closed beta.",
          "Libraries Global is in a closed beta. Features, limits and availability can change, and some features are introduced in stages. During the beta, checkout uses test payments and no real payment is taken until live purchases are announced."
        ),
      ],
    },
    {
      slug: "privacy",
      mode: "merge",
      summary:
        "Explains API billing references, usage events, submitted payloads, analysis job retention, recognition counters, sponsor records and analytics for access journeys. Withdrawn membership and Team billing processing removed.",
      replace: {
        "Membership and payment information": section(
          "API billing and payment information",
          "Private billing references support API subscriptions; card details stay with Stripe.",
          "When an organiser buys API access, we share the organisation's name, the organiser's name and verified email and a private reference with Stripe to bind the purchase. Stripe's hosted checkout collects payment and billing information under its own terms. We store minimal customer, checkout, subscription and invoice references, the accepted terms and overage versions, the offer snapshot, overage cap changes, payment status and reconciliation results. We use them to provide the service, invoice usage, handle support and prevent duplicate charges. We do not receive or store full card numbers or CVCs. Minimal billing references are kept for six years after an account or API account is closed, for tax and accounting."
        ),
        "Team API keys and usage": section(
          "API keys and usage records",
          "Usage records support allowances and invoices; they do not contain your requests' content.",
          "For each key we store its organisation, a digest and display prefix, scopes, expiry, creator and the audit of creation, regeneration and revocation. The full key is shown once and not retained. For each settled request or completed job we keep an immutable usage event: organisation and key reference, endpoint category, time, outcome, response size and analysis credits. Usage quantities are sent to Stripe for invoicing, identified by the organisation's billing reference. Detailed usage records are kept for 90 days; period totals, invoices and key audit events are kept longer for billing and security. Usage records do not contain search text, request bodies, IP addresses or raw keys."
        ),
      },
      add: [
        section(
          "API submissions and analysis jobs",
          "Proposals join the moderation record; job results expire.",
          "Proposals sent through the API are stored like other submissions: the proposed data, evidence and sources, the submitting API account, an idempotency key and the review history. They are kept as part of the moderation and change history after a decision. Pending analysis jobs expire after 30 minutes. Completed Reach results are kept for 24 hours and summary results for 15 minutes; job inputs and metadata are kept for 30 days, then deleted. Separate billing usage records follow the retention described above. Do not include personal data in proposals unless it is the public contact information of a library."
        ),
        section(
          "Recognition records",
          "We count accepted contributions to show recognition.",
          "Your profile stores the number of accepted contributions, the time of the latest one and whether a moderator revoked recognition. We use them to show Contributor and Supporter status and recent activity. Public display follows your profile privacy choices."
        ),
        section(
          "Sponsors",
          "Sponsor records are kept separately from accounts.",
          "For sponsorship we keep the organisation's details, contacts, agreement and term, recognition consent, logo and acknowledgement text. They are used to manage the agreement and publish acknowledgements only with consent. They never affect entitlements, ranking or moderation."
        ),
        section(
          "Analytics for access and the API",
          "Optional analytics stay optional.",
          "With your analytics consent, we measure use of public pages and selected workspace actions, API checkout steps, and successful contact form submissions to understand whether the service works. A contact form event does not identify whether the enquiry concerns sponsorship. These measurements do not include API keys, request bodies, proposal content or payment details. API requests, key activity, quota warnings and overage changes are recorded in essential server records for access and billing, separately from optional analytics. Without consent, no optional analytics are collected. Analytics choice and our GA cookies last up to 180 days without rolling renewal. Google Analytics event-level data is retained for two months and user-level data for 14 months, with the latter reset on new activity; aggregate reports may remain separately. You can withdraw consent at any time to stop future optional collection and contact us about your privacy rights. See the [cookie policy](/legal/cookies)."
        ),
      ],
    },
    {
      slug: "data-licence",
      mode: "merge",
      summary:
        "Explains licences and attribution for API responses, contributions submitted through the API and analysis results. Paid access does not change the licence.",
      replace: {},
      add: [
        section(
          "API responses",
          "The same licence applies, with source credits.",
          "Library records returned by the API are under the same licence as the rest of the index. Responses include attribution and source records, including each dataset's licence, redistribution status and required credit. Keep them with the data. Where a source has a different licence or restricts redistribution, its terms also apply to the fields taken from it. An unknown or missing licence does not grant permission to redistribute."
        ),
        section(
          "Contributions through the API",
          "Accepted proposals are published under this licence.",
          "When a proposal sent through the API is accepted, its contribution is published under this licence. By submitting, you confirm that you have the right to license the material in this way. Do not submit text, images or data copied from sources that do not allow it."
        ),
        section(
          "Analysis results",
          "Results carry the credits of the data they use.",
          "Analysis and Reach results combine published records with third-party datasets, such as population grids, routing data from OpenStreetMap contributors and official statistics. Keep the source credits and dates supplied with a result and follow those sources' terms. If a result is a Produced Work derived from OpenStreetMap data, credit OpenStreetMap and its contributors as required by the ODbL. If you publicly use or distribute an adapted database made from ODbL data, the ODbL may require you to make that adapted database available under the same licence. The distinction depends on what you create and how you use it; consult the [OpenStreetMap attribution guidance](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) and [ODbL](https://opendatacommons.org/licenses/odbl/summary/index.html) before reuse."
        ),
        section(
          "Paid access and sponsorship",
          "Payment does not change what you may do with the data.",
          "Paying for API access or sponsoring Libraries Global does not change the licence, remove attribution requirements or grant rights that a source does not allow. The API charge is for a managed, metered service, not for the data itself."
        ),
      ],
    },
  ]
}

// ---------------------------------------------------------------------------
// CMS payloads.

const strip = (value) =>
  Array.isArray(value)
    ? value.map(strip)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== "id")
            .map(([key, child]) => [key, strip(child)])
        )
      : value

export const sectionData = ({ heading, inShort, markdown }) => ({
  heading,
  inShort,
  body: markdownBlocks(markdown),
})

/** Next major revision after every recorded one, e.g. 1.4 → 2.0. */
export function nextMajorVersion(revisions = []) {
  const majors = revisions
    .map((revision) => Number.parseInt(String(revision.version), 10))
    .filter(Number.isFinite)

  return `${majors.length ? Math.max(...majors) + 1 : 1}.0`
}

/**
 * Draft data for one legal document. Existing revision rows are kept exactly
 * and one new revision is appended. Merge drafts replace named sections, add
 * new ones and remove retired sentences elsewhere; replace drafts rewrite
 * the document. Throws when the new version already exists with other text.
 */
export function legalDraftData(doc, draft, date) {
  const history = strip(doc?.revisions ?? [])
  const priorStaged = history.find((r) => r.summary === draft.summary)
  const prior = priorStaged ? history.filter((r) => r !== priorStaged) : history
  const version = priorStaged?.version ?? nextMajorVersion(prior)
  if (prior.some((r) => r.version === version))
    throw new Error(`Revision ${version} already exists: ${draft.slug}`)
  const report = {
    slug: draft.slug,
    version,
    replaced: [],
    added: [],
    scrubbed: [],
  }
  let sections
  if (draft.mode === "replace") sections = draft.sections.map(sectionData)
  else {
    if (!doc) throw new Error(`Missing legal document: ${draft.slug}`)
    sections = strip(doc.sections ?? []).filter(
      (s) => s.heading !== REVIEW_HEADING
    )
    for (const [heading, replacement] of Object.entries(draft.replace)) {
      const position = sections.findIndex(
        (s) => s.heading === heading || s.heading === replacement.heading
      )
      if (position === -1) sections.push(sectionData(replacement))
      else sections[position] = sectionData(replacement)
      report.replaced.push({ heading, found: position !== -1 })
    }
    for (const addition of draft.add) {
      const position = sections.findIndex((s) => s.heading === addition.heading)
      if (position === -1) sections.push(sectionData(addition))
      else sections[position] = sectionData(addition)
      report.added.push(addition.heading)
    }
    const owned = new Set([
      ...Object.values(draft.replace).map((s) => s.heading),
      ...draft.add.map((s) => s.heading),
    ])
    sections = sections.map((s) => {
      if (owned.has(s.heading)) return s
      const { blocks, removed } = scrubBlocks(s.body ?? [], "en")
      if (removed.length) report.scrubbed.push({ heading: s.heading, removed })

      return removed.length ? { ...s, body: blocks } : s
    })
  }
  const data = {
    ...(draft.mode === "replace" ? strip(draft.metadata) : {}),
    sections: [sectionData(reviewSection(date)), ...sections],
    revisions: [
      ...prior,
      { version, date, summary: draft.summary, changesUrl: null },
    ],
  }

  return { data, report }
}

/** Review copy for apps/docs/docs/proposals/legal-drafts/. */
export function legalDraftMarkdown(draft, date, version = "next major") {
  const lines = [
    "---",
    `title: "Draft: ${draft.metadata?.title ?? draft.slug} (legal review)"`,
    `description: "Draft revision of /legal/${draft.slug} for the sponsored-access model. Requires legal review before publication."`,
    "---",
    "",
    `# Draft: ${draft.metadata?.title ?? `/legal/${draft.slug}`}`,
    "",
    `**Status:** draft for legal review, prepared ${date}. Not in force. Do not publish until legal review and the matching release acceptance are complete.`,
    "",
    `CMS document: \`${draft.slug}\` (English). Revision: ${version}. Mode: ${draft.mode === "replace" ? "replaces the whole document" : "replaces or adds the sections below; other published sections are kept, with retired paid-plan sentences removed"}. Staged by \`apps/strapi/scripts/update-sponsored-access-content.mjs --stage\`; generated from \`apps/strapi/scripts/sponsored-access-legal-content.mjs\`. Edit the script, not this file.`,
    "",
    `Revision summary: ${draft.summary}`,
    "",
  ]
  if (draft.metadata) {
    lines.push(`Lead: ${draft.metadata.lead}`, "", "Summary points:", "")
    for (const point of draft.metadata.summaryPoints)
      lines.push(`- ${point.text}`)
    lines.push("")
  }
  const write = (s, note) => {
    lines.push(`## ${s.heading}`, "")
    if (note) lines.push(`_${note}_`, "")
    lines.push(`_In short: ${s.inShort}_`, "", s.markdown.trim(), "")
  }
  write(reviewSection(date))
  if (draft.mode === "replace") draft.sections.forEach((s) => write(s))
  else {
    for (const [heading, s] of Object.entries(draft.replace))
      write(s, `Replaces the published section “${heading}”.`)
    draft.add.forEach((s) => write(s, "New section."))
  }

  return lines.join("\n")
}
