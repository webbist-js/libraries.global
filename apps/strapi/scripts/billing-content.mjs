import pricing from "../../ui/src/lib/membership-pricing.json" with { type: "json" }

const pounds = (pence) => `£${pence / 100}`
const discounted = (pence) =>
  pence * (1 - pricing.team.publicServiceDiscountPercent / 100)

export const teamPricingText = `Team costs ${pounds(pricing.team.year)}/year for ${pricing.team.includedSeats} seats, with additional seats at ${pounds(pricing.team.extraSeatYear)}/year each, excluding VAT. Public library services receive ${pricing.team.publicServiceDiscountPercent}% off: ${pounds(discounted(pricing.team.year))}/year for ${pricing.team.includedSeats} seats and ${pounds(discounted(pricing.team.extraSeatYear))}/year per additional seat, excluding VAT. When self-service Team purchases are available, create a Team online and subscribe yearly through Stripe. The subscription uses a five-seat minimum and renews annually until cancelled. The approved public-library-service discount is selected by the server; checking a service-type estimate does not grant eligibility. Existing invoice agreements keep their agreed terms. Payment never verifies a Team or grants library staff authority.`
export const proPricingText = `Pro's founding price remains ${pounds(pricing.pro.founding.month)}/month or ${pounds(pricing.pro.founding.year)}/year while the membership continues. The standard price will be ${pounds(pricing.pro.standard.month)}/month or ${pounds(pricing.pro.standard.year)}/year once Reach ships; it is not offered before those tools are available.`

const paragraph = (text) => ({
  type: "paragraph",
  children: [{ type: "text", text }],
})
const linkedParagraph = (...parts) => ({
  type: "paragraph",
  children: parts.map((part) =>
    typeof part === "string"
      ? { type: "text", text: part }
      : {
          type: "link",
          url: part.url,
          children: [{ type: "text", text: part.text }],
        }
  ),
})
const heading = (text) => ({
  type: "heading",
  level: 2,
  children: [{ type: "text", text }],
})
const section = (title, inShort, ...body) => ({
  heading: title,
  inShort,
  body: body.map((value) =>
    typeof value === "string" ? paragraph(value) : value
  ),
})

export function membershipLegalContent(
  operator,
  postalAddress = "Postal contact address must be confirmed before live checkout is enabled.",
  contactEmail = "info@libraries.global"
) {
  const contact = postalAddress

  return [
    {
      title: "Membership terms",
      heroTitle: "Membership *terms.*",
      slug: "membership",
      navLabel: "Membership",
      lead: "Terms for Supporter, Pro, Team and Team API digital tools, recurring payments and access.",
      order: 3,
      summaryPoints: [
        { text: "Library facts and community participation remain free." },
        {
          text: "Stripe confirms the price, tax and recurring payment before you pay.",
        },
        {
          text: "Cancel renewal in Membership & billing; statutory rights remain unchanged.",
        },
      ],
      sections: [
        section(
          "Self-service Team subscriptions",
          "Team billing and seat management belong to the organisation.",
          "Create a Team at /staff/teams/new, choose at least five seats and accept the Team terms before Stripe Checkout. Confirmed settled payment activates the Team and its paid seat allowance; a checkout return or an unpaid subscription does not grant access. The purchaser becomes its Organiser and can invite colleagues and select covered Libraries. Each account belongs to one Team, including when it is lapsed or awaiting payment. Add seats to that Team as it grows; moving to another Team requires removal from the previous Team and any necessary Organiser handover. Payment never verifies Library authority.",
          "Organisers manage invoices, payment details, annual renewal cancellation and seat quantities from Team billing. Stripe shows the exact proration before a seat increase. Additional access starts only after the matching payment is confirmed. Reductions start at renewal; remove excess members and invitations before the reduction takes effect. Invitations reserve seats and cannot exceed a scheduled lower allowance. A Team with more occupied seats than its paid allowance has access suspended until an organiser removes excess seats or pays for more, then refreshes payment status. A failed renewal may receive up to seven days of grace from the original failure; retries do not extend it.",
          "Every Team needs an active Organiser. Before deleting the last Organiser's account, transfer that role to another active member or discard an unused Team from Team billing. Discarding closes open checkouts and is unavailable while the Team has an ongoing subscription or paid period, another active member, or an ongoing API subscription. Team and API renewals remain separate. Existing annual invoice agreements are preserved and require an arranged migration to subscription billing."
        ),
        section(
          "Team API add-on",
          "API access is a separate recurring purchase for an active Team, with shared usage limits.",
          `When API purchases are available, a Team Organiser can buy and manage the ${pounds(pricing.teamApi.month)}/month API add-on from Staff area → Team → API access. The add-on supplies versioned access to published public Library search and records. It does not grant staff authority, access to user accounts or protected content. Keys belong to the Team; every key shares its monthly request and response-data allowances. The Team can create unlimited API keys. The default 100,000 successful requests and 10 GiB of uncompressed response data are one monthly pool shared across all keys and members; adding keys or seats does not increase the pool. The allowance, rate, concurrency and response-size limits shown before purchase are recorded with that purchase. Monthly allowances reset at 00:00 UTC on the first day of each calendar month and do not roll over. A purchase partway through a month receives the full current calendar-month allowance.`,
          "Successful responses, including cache hits, count towards the monthly request allowance. Response data means the uncompressed JSON payload produced by the API, not the hosting provider's network-traffic figure; separately downloaded media is excluded. Failed responses do not consume the monthly allowance, but attempts are subject to rate limits. Reaching a limit stops further requests until capacity or the next monthly allowance becomes available. There are no automatic usage overage charges.",
          "Team Organisers can create, regenerate and revoke keys. Regeneration invalidates the previous key immediately and does not reset usage. Keys cannot make requests when the Team or paid API access is inactive. Cancel the API subscription through Manage API billing; normal access continues through the settled paid period while the Team remains active. Renewing Team membership and renewing the API add-on are separate transactions. The cancellation, refund and payment-reversal provisions below also apply to the add-on. Preserve the dataset licences and source credits included in responses."
        ),
        section(
          "The service and operator",
          "Libraries Global sells the membership service; Stripe handles the payment transaction.",
          linkedParagraph(
            `Libraries Global is operated by ${operator}. These membership terms supplement the `,
            { text: "general terms of use", url: "/legal/terms" },
            `. Membership, access and cancellation enquiries: ${contactEmail}. Postal contact: ${contact}`
          ),
          linkedParagraph(
            `The operator named above is the seller and supplier of the membership service. Stripe Managed Payments, provided by Sold through Link, LLC or its affiliates, acts as merchant of record for the payment transaction. Merchant of record does not mean seller of record: we remain responsible for the tools, their delivery and our obligations to customers. Stripe handles payment processing, applicable indirect taxes, financial confirmations and transaction support under the Link terms shown at checkout. These membership terms describe the service we supply. `,
            {
              text: "Link transaction support",
              url: "https://support.link.com/topics/sold-through-link",
            },
            " can help with payment questions."
          )
        ),
        section(
          "The tools you receive",
          "Supporter includes history and small exports; Pro adds larger exports and comparisons.",
          "Supporter includes detailed library change history and Atlas CSV/GeoJSON exports of up to 500 libraries in a download. Pro includes those tools, exports of up to 10,000 libraries and delivered population comparisons. Unfinished tools are labelled coming soon and are not promised as currently available. Individual public records and downloads, contributions, following, saved events and free opt-in weekly emails remain free.",
          "Membership does not grant points, trust, a community role, moderation privileges or staff access. Optional profile recognition and public credit have independent privacy choices; private and limited profiles are never listed."
        ),
        section(
          "Prices, taxes and renewal",
          "The total and recurring interval are confirmed before payment.",
          `Current base prices are Supporter ${pounds(pricing.supporter.month)} monthly or ${pounds(pricing.supporter.year)} yearly, and founding Pro ${pounds(pricing.pro.founding.month)} monthly or ${pounds(pricing.pro.founding.year)} yearly. These GBP prices include applicable tax. Stripe confirms the final tax, any localized currency and recurring total before you pay; the invoice shows the actual charge. A monthly membership renews monthly and a yearly membership renews yearly until renewal is stopped. ${teamPricingText}`,
          proPricingText,
          "A founding subscription keeps its existing recurring Price while that subscription continues. A plan or interval change uses the Price and effective date in the confirmed Stripe review. We do not replace an existing Price silently or sell a promised future feature as delivered. Any future price change will be explained before it affects a renewal."
        ),
        section(
          "Starting access",
          "Request immediate access without waiving statutory rights.",
          "By checking the membership consent and continuing, you request that the tools become available immediately after payment is confirmed. This request does not waive statutory cancellation or other consumer rights. Access begins only after the matching invoice is settled and the application has synchronized confirmation; an unpaid purchase or upgrade grants no new tools.",
          "Your verified account owns a personal Supporter or Pro membership. Team and Team API subscriptions belong to the organisation and are managed by its Organisers. Financial confirmations are sent by Stripe; Libraries Global sends a separate access notice. If confirmation is delayed, check the relevant personal or Team billing page and contact support rather than creating another payment."
        ),
        section(
          "Changing plans and stopping renewal",
          "Review the exact charge and timing with Stripe.",
          "Use Membership & billing in Settings for invoices, payment details, billing details, plan changes and renewal cancellation. Stripe displays the exact charge and unused-time credit before a paid upgrade is confirmed. Lower plans and shorter billing intervals are reviewed in Settings and scheduled for the paid period end, with nothing charged today. Use Undo scheduled change before it starts. For an interval change created in Stripe's portal, use Update subscription → Cancel change.",
          "Stopping renewal normally keeps settled access until the paid period ends. A failed upgrade does not remove an already-settled lower plan. A failed renewal can receive a seven-day grace period from the first failure; repeated retries do not restart it. Complimentary access from contributions, verification, grants or Team membership is assessed independently."
        ),
        section(
          "Cancellation, refunds and complaints",
          "Renewal cancellation and a refund request are separate.",
          linkedParagraph(
            "Read our ",
            {
              text: "cancellation and refund policy",
              url: "/legal/cancellation-refunds",
            },
            " and the Link transaction terms shown at checkout. Link's refund policy takes precedence over any more restrictive refund policy we set. Statutory consumer rights also apply. Stopping renewal does not by itself request a refund. Nothing here excludes rights that the law gives you."
          ),
          `For tool/access problems contact ${contactEmail}. For transaction or refund support use the support route on your Stripe checkout or financial confirmation; you may also contact us to help identify the order. Do not send passwords, full card details or sign-in links. A full current-period refund or a payment dispute can suspend the affected paid access while independent complimentary access remains.`
        ),
        section(
          "Account deletion and financial records",
          "Billing is stopped before account erasure.",
          "Account deletion first cancels personal subscriptions and expires personal checkout sessions. If that cannot be confirmed, deletion is refused until billing is reconciled. Before the last active Team Organiser deletes their account, another active member must become Organiser or an eligible unused Team must be discarded. A Team with another Organiser keeps its organisation-owned subscriptions; deleting the original purchaser does not cancel them. Completed event references are removed after 90 days. Minimal account/payment reference bindings are removed six years after account erasure by daily housekeeping; they prevent late events from recreating access. Stripe handles its own financial records and any separate deletion request under its privacy terms.",
          linkedParagraph(
            "Our ",
            { text: "privacy notice", url: "/legal/privacy" },
            " explains payment references, consent records and account information."
          )
        ),
      ],
    },
    {
      title: "Cancellation and refunds",
      heroTitle: "Cancellation *and refunds.*",
      slug: "cancellation-refunds",
      navLabel: "Cancellation & refunds",
      lead: "How to stop membership renewal, request a refund and get payment help.",
      order: 4,
      summaryPoints: [
        { text: "Stop renewal in Settings without deleting your account." },
        {
          text: "Settled access normally continues until the paid period ends.",
        },
        {
          text: "Statutory cancellation and consumer rights remain unchanged.",
        },
      ],
      sections: [
        section(
          "Who to contact",
          "Send membership and cancellation requests to info@libraries.global.",
          `Libraries Global is operated by ${operator}, the seller and supplier of the membership service. Contact: ${contactEmail}. Postal contact: ${contact}. Stripe Managed Payments acts as merchant of record for the payment transaction and provides transaction support through Link. This does not replace our responsibilities as the service seller.`,
          linkedParagraph(
            "This policy accompanies our ",
            { text: "membership terms", url: "/legal/membership" },
            ". It explains both stopping future renewals and cancelling a purchase or requesting a refund."
          )
        ),
        section(
          "Stop future renewals",
          "Use Membership & billing in Settings.",
          "Sign in to the account that bought the membership, open Settings → Membership & billing → Manage membership, and use Stripe's cancellation controls. You can also manage renewal through Link using your financial confirmation if you cannot enter our app. You do not need to delete your account or contact us just to stop renewal. Check the effective date and retain the confirmation. Settled tools normally remain available to the paid period end."
        ),
        teamSubscriptionCancellationSection,
        teamApiCancellationSection,
        section(
          "Request a refund or exercise statutory cancellation rights",
          "Use the transaction support route shown on the Stripe confirmation.",
          `Use Link's transaction-support route shown on your financial confirmation to request a payment refund. You can also notify us at ${contactEmail} to exercise a statutory cancellation right or ask about a refund. Include the invoice reference, account email, purchase date and request; we will help identify the transaction and coordinate with Link where needed.`,
          "For UK consumers buying a service online, the statutory cancellation period normally ends 14 days after the day the contract is entered into. Tell us clearly that you wish to cancel before that period ends; no special form is required. Requesting immediate tool access does not waive these rights. Any lawful proportionate charge for a service already supplied must meet the applicable legal conditions. Other countries may provide additional rights. Any cancellation or refund rights that apply to a renewal are also honoured. Stopping renewal is separate from cancelling a purchase or requesting a refund.",
          linkedParagraph(
            "Our refund policy is subject to ",
            {
              text: "Link's refund policy",
              url: "https://support.link.com/questions/sold-through-link-refunds",
            },
            ". Link's policy prevails if ours is more restrictive, and statutory rights remain unaffected. Link may also authorise refunds under its policy even when our own policy would not. This is not a promise of an unconditional refund for every purchase."
          )
        ),
        section(
          "Refund timing and payment method",
          "Statutory refunds follow the applicable deadline and original payment method.",
          "For a valid UK statutory cancellation of a service, reimbursement is due without undue delay and normally within 14 days after the seller is informed of the cancellation, subject to any lawful charge for service already supplied. The same payment method is used unless you expressly agree otherwise, and no refund fee is charged. Your bank or payment provider may take additional time to display the returned funds.",
          "For other refund requests, Link's refund policy, the transaction terms and applicable law determine eligibility and timing. If the tools do not match their description or are faulty, your statutory remedies remain available. Contact us about the access/service problem; Link handles the payment refund process."
        ),
        section(
          "Information to include",
          "Order reference, date and a clear request; no payment credentials.",
          `You can write: I wish to cancel my membership purchase and request the refund available under my applicable cancellation rights. Include your name, account email, invoice/order reference and purchase date. Email: ${contactEmail}. Postal contact: ` +
            contact +
            ". Do not include a password, sign-in link, full card number or CVC."
        ),
        section(
          "Model cancellation form",
          "Optional example for statutory cancellation; no form is needed to stop renewal in Settings.",
          "You do not need to fill in this form to stop future renewals. Use Settings → Membership & billing → Manage membership for that. The example below is an optional way to tell us that you are exercising a statutory cancellation right for the membership purchase. You can instead email a clear statement in your own words. Stopping renewal through the billing controls does not automatically request a refund of a payment already made.",
          `To ${operator}, postal contact: ${contact}; email: ${contactEmail}.`,
          "I give notice that I cancel my contract for the following membership service: [Supporter, Pro, Team or Team API add-on].",
          "Ordered on: [date]. Name: [your name]. Address: [your address]. Account email and order reference: [details]. Date: [date]. Signature: [only if sent on paper]."
        ),
        section(
          "What happens to access",
          "A refunded paid period can end; free access remains.",
          "A full refund of the current paid period or a payment dispute can suspend the affected paid access. Partial refunds and refunds of an earlier period do not automatically remove a later settled period. Public records and a free account remain available, and independent complimentary Pro/Team access is assessed separately. Optional recognition follows current eligible access."
        ),
        section(
          "If something goes wrong",
          "Check billing status and contact support before paying again.",
          `If a payment is uncertain or membership remains confirming, check your owned billing page and financial confirmation before submitting another payment. Contact ${contactEmail} for access problems. For unresolved transaction issues, use Link's complaints/support process. You can also contact us about your membership contract and statutory rights. Your statutory remedies are unaffected.`,
          linkedParagraph(
            "You can read the ",
            {
              text: "UK Consumer Contracts Regulations",
              url: "https://www.legislation.gov.uk/uksi/2013/3134",
            },
            " and contact ",
            {
              text: "Link transaction support",
              url: "https://support.link.com/topics/sold-through-link",
            },
            " for payment help."
          )
        ),
      ],
    },
  ]
}

export const billingPrivacySection = section(
  "Membership and payment information",
  "Private billing references support membership; full card details stay with Stripe.",
  "When you buy a membership, we share your account name, verified email and a private account reference with Stripe to bind the purchase to you. Stripe's hosted checkout collects payment and billing information under its own terms. We store minimal customer, checkout, subscription and invoice references, the accepted membership-terms version, plan/price/period, payment confirmation and reconciliation status. We use these to provide contracted access, handle support, prevent duplicate purchases and reconcile billing.",
  "The owned billing page retrieves masked card brand, last four digits and expiry, billing details and recent invoice links from Stripe when you request them. Libraries Global does not receive or store your full card number or CVC. Financial and entitlement data are private and do not appear in public profiles or the supporters directory. Public recognition is optional and respects profile visibility.",
  "Stripe's merchant-of-record service is independently responsible for its transaction, fraud, tax and financial-record processing. Account erasure stops billing first. Completed event references are removed after 90 days. Minimal account/payment reference bindings are removed six years after account erasure by daily housekeeping. Unresolved retry work is retained until reconciled. These references cannot sign you in or recreate paid access. Essential access notices do not enrol you in marketing."
)

export const teamSubscriptionCancellationSection = section(
  "Annual Team subscriptions",
  "Organisers manage Team renewal and seats from Team billing.",
  "Open /staff/teams/billing for the correct Team and choose Manage Team billing and seats to cancel annual renewal, update payment details or view invoices. Access normally continues through the settled paid period. A cancellation stops future renewals; it does not automatically request a refund. Use the refund and statutory cancellation routes below for that request.",
  "Stripe shows the charge before you confirm a seat increase. Increased access begins after payment is confirmed. Seat reductions start at renewal; remove excess members and invitations before that date. Team and API subscriptions are separate: cancel the API add-on separately when it is no longer needed. Existing invoice agreements retain their agreed cancellation terms."
)

export const teamApiPrivacySection = section(
  "Team API keys and usage",
  "Private key records and usage counters support the Team API add-on.",
  "When Team API access is available, we store the Team reference, key hash and display prefix, scopes, expiry, creation/regeneration/revocation audit and last use. The full key is shown once and is not retained. Team billing uses the Team name, organiser's verified email, creator and consenting actor references, accepted terms version, seat quantities and private Team/payment references. Team and API subscriptions belong to the organisation separately from a person's membership. Transferring an Organiser role does not transfer a personal membership or change the organisation's payment method. Archived Team financial bindings are retained for six years; unresolved retry work is retained until reconciled.",
  "Usage records contain the Team/key reference, endpoint category, time, outcome and uncompressed JSON response-byte count. They support shared allowances and the staff usage dashboard. Detailed request records are retained for 90 days; monthly totals and key audit events are retained longer. Raw keys, search text, request bodies and IP addresses are not retained in these usage records. Usage is private to the Team and does not change community roles, points or staff authority."
)

export const teamApiCancellationSection = section(
  "Team API renewal",
  "The API add-on has separate renewal controls in the Staff area.",
  "When Team API purchases are available, stop renewal through Staff area → Team → Manage API billing. Settled API access continues through the paid period while the Team remains active. Lapsing a Team stops requests but does not automatically cancel its API subscription. The refund and statutory cancellation provisions in this policy also apply to the Team API add-on; stopping renewal and requesting a refund are separate actions."
)

export const billingCookiesSection = section(
  "Stripe checkout and billing",
  "The payment page has its own essential payment and fraud controls.",
  "Checkout and payment management open Stripe's hosted pages. Those pages may use their own cookies and fraud-prevention technology under the policies shown there. Our membership modal does not collect card details or embed a custom payment form. Stripe cookies do not provide Libraries Global with advertising tracking on this site."
)

export const billingKnowledgeSections = [
  heading("Supporter and Pro digital tools"),
  paragraph(
    `Supporter costs ${pounds(pricing.supporter.month)}/month or ${pounds(pricing.supporter.year)}/year and includes detailed library change history and Atlas CSV/GeoJSON exports of up to 500 libraries per download. Pro costs the current founding price of ${pounds(pricing.pro.founding.month)}/month or ${pounds(pricing.pro.founding.year)}/year, includes those tools, raises the export cap to 10,000 and adds delivered population comparisons. Unfinished tools are labelled Coming soon. ${teamPricingText} ${proPricingText}`
  ),
  heading("Checkout and your account"),
  paragraph(
    "Choose a plan, sign in with a verified account, read the membership terms and continue to Stripe's secure checkout. Stripe confirms tax, local currency and the final recurring charge. Card and eligible Apple Pay/Google Pay options are provided by Stripe. Wait for confirmed membership access rather than paying again if the return is delayed."
  ),
  heading("Manage membership in Settings"),
  paragraph(
    "Membership & billing shows your paid membership separately from current access, because contributions, verification, grants or Team seats can provide complimentary Pro. Use Manage membership for masked payment/billing details, recent invoice PDFs and renewal cancellation. Change plan sends paid upgrades to Stripe's exact proration review. Lower plans and shorter intervals are reviewed in Settings, with no charge today, and start at the paid period end. Use Undo scheduled change before it starts. For a change made in Stripe's portal, use Update subscription → Cancel change."
  ),
  heading("Renewal failures and account deletion"),
  paragraph(
    "Unpaid upgrades grant no new tools and preserve an already-settled Supporter period. A failed renewal has a bounded seven-day grace period from the first failure. Account deletion first stops billing; it is refused if cancellation cannot be confirmed. Full current-period refunds/disputes can remove only paid access, while independent complimentary access still applies. Read the membership and cancellation/refund policies for your statutory rights and support routes."
  ),
  heading("Recognition and free participation"),
  paragraph(
    "Membership never grants trust, a community role, points, editing authority or staff access. Following, saved events, contributions and free weekly opt-in emails remain free. Supporter mark and public credit are independent Privacy choices; private or limited profiles are never listed. Buying membership does not subscribe you to newsletters or marketing."
  ),
]
