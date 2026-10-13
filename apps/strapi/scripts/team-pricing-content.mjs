import {
  membershipLegalContent,
  proPricingText,
  teamApiCancellationSection,
  teamApiPrivacySection,
  teamPricingText,
} from "./billing-content.mjs"

import pricing from "../../ui/src/lib/membership-pricing.json" with { type: "json" }

const text = (value) => ({ type: "text", text: value })
const paragraph = (value) => ({ type: "paragraph", children: [text(value)] })
const heading = (value) => ({
  type: "heading",
  level: 2,
  children: [text(value)],
})
const discounted = (value) =>
  (value * (1 - pricing.team.publicServiceDiscountPercent / 100)) / 100
const copy = {
  en: {
    heading: "Team prices and API access",
    team: teamPricingText,
    pro: proPricingText,
    api: `The Team API add-on is being prepared for the closed beta. It will be a separate £${pricing.teamApi.month / 100}/month purchase for an active Team, with monthly allowances of 100,000 successful requests and 10 GiB of uncompressed JSON response data, and up to five active keys. Team Organisers will manage keys and billing; members will be able to view usage. API purchases are not enabled in production yet.`,
    cancellation:
      "Team membership and API billing are separate. A lapsed Team stops API requests but does not cancel the API subscription; the organiser must stop renewal through Manage API billing. Library staff authority and Team verification are independent of payment.",
  },
  fr: {
    heading: "Tarifs Team et accès à l’API",
    team: `Team coûte ${pricing.team.year / 100} £ par an hors TVA pour ${pricing.team.includedSeats} places, puis ${pricing.team.extraSeatYear / 100} £ par an hors TVA par place supplémentaire. Les services de bibliothèques publiques bénéficient de ${pricing.team.publicServiceDiscountPercent} % de réduction : ${discounted(pricing.team.year)} £ par an pour cinq places et ${discounted(pricing.team.extraSeatYear)} £ par place supplémentaire, hors TVA. Team fait l’objet d’un devis et d’une facture annuelle ; nous configurons l’équipe et ses places après confirmation du paiement.`,
    pro: `Le tarif fondateur Pro reste de ${pricing.pro.founding.month / 100} £ par mois ou ${pricing.pro.founding.year / 100} £ par an tant que l’adhésion continue. Le tarif standard sera de ${pricing.pro.standard.month / 100} £ par mois ou ${pricing.pro.standard.year / 100} £ par an lorsque les outils Reach seront disponibles ; il n’est pas proposé avant leur disponibilité.`,
    api: `Une option API pour Team est en préparation pour la bêta fermée. Elle sera facturée séparément ${pricing.teamApi.month / 100} £ par mois pour une équipe active, avec 100 000 requêtes réussies, 10 Gio de réponses JSON non compressées et cinq clés actives par mois civil. Les organisateurs géreront les clés et la facturation ; les membres pourront consulter l’utilisation. Les achats API ne sont pas encore activés en production.`,
    cancellation:
      "L’adhésion Team et la facturation API sont distinctes. Une équipe inactive ne peut plus utiliser l’API, mais l’abonnement API n’est pas annulé automatiquement : l’organisateur doit arrêter son renouvellement dans Manage API billing. Le paiement n’accorde ni vérification de l’équipe ni droits d’accès au personnel.",
  },
  cs: {
    heading: "Ceny Team a přístup k API",
    team: `Team stojí ${pricing.team.year / 100} £ ročně bez DPH za ${pricing.team.includedSeats} míst a ${pricing.team.extraSeatYear / 100} £ ročně bez DPH za každé další místo. Veřejné knihovní služby mají slevu ${pricing.team.publicServiceDiscountPercent} %: ${discounted(pricing.team.year)} £ ročně za pět míst a ${discounted(pricing.team.extraSeatYear)} £ za každé další místo, bez DPH. Team má individuální nabídku a roční fakturaci; tým a místa nastavíme po potvrzení platby.`,
    pro: `Zakládající cena Pro zůstává ${pricing.pro.founding.month / 100} £ měsíčně nebo ${pricing.pro.founding.year / 100} £ ročně, dokud členství trvá. Standardní cena bude ${pricing.pro.standard.month / 100} £ měsíčně nebo ${pricing.pro.standard.year / 100} £ ročně po zpřístupnění nástrojů Reach; předtím se nenabízí.`,
    api: `Pro uzavřenou betu připravujeme doplněk Team API. Pro aktivní tým bude stát samostatně ${pricing.teamApi.month / 100} £ měsíčně a nabídne 100 000 úspěšných požadavků, 10 GiB nekomprimovaných odpovědí JSON a pět aktivních klíčů za kalendářní měsíc. Organizátoři budou spravovat klíče a fakturaci; členové uvidí využití. Nákupy API zatím nejsou v produkci zapnuté.`,
    cancellation:
      "Členství Team a fakturace API jsou oddělené. Neaktivní tým ztratí přístup k API, ale předplatné API se automaticky nezruší; organizátor musí zastavit obnovování přes Manage API billing. Platba neposkytuje ověření týmu ani oprávnění zaměstnanců knihovny.",
  },
}

export const pricingGuideSlugs = new Set([
  "plans-and-pro",
  "plans-and-staff-access",
  "teams-for-library-services",
  "your-account-and-profile",
  "deleting-your-account",
  "change-history-on-library-pages",
  "reusing-the-data",
  "sources-and-data-retention",
])
export function stripComponentIds(value) {
  if (Array.isArray(value)) return value.map(stripComponentIds)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "id")
        .map(([key, child]) => [key, stripComponentIds(child)])
    )

  return value
}
export function pricingGuideBody(doc, locale) {
  if (!pricingGuideSlugs.has(doc.slug) || !copy[locale]) return null
  const body = stripComponentIds(doc.body ?? [])
  const localized = copy[locale]
  const fragment = {
    __component: "content.rich-text",
    body: [
      heading(localized.heading),
      paragraph(localized.team),
      paragraph(localized.pro),
      paragraph(localized.api),
      paragraph(localized.cancellation),
    ],
  }
  const position = body.findIndex(
    (component) =>
      component.__component === "content.rich-text" &&
      component.body?.[0]?.children?.[0]?.text === localized.heading
  )
  if (position === -1) body.push(fragment)
  else body[position] = fragment

  return body
}
export function pricingLegalSections(doc) {
  if (!["membership", "privacy", "cancellation-refunds"].includes(doc.slug))
    return null
  const sections = stripComponentIds(doc.sections ?? [])
  if (doc.slug === "privacy") {
    const position = sections.findIndex(
      (section) => section.heading === teamApiPrivacySection.heading
    )
    if (position === -1) sections.push(teamApiPrivacySection)
    else sections[position] = teamApiPrivacySection

    return sections
  }
  if (doc.slug === "cancellation-refunds") {
    const section = teamApiCancellationSection
    const position = sections.findIndex(
      (candidate) => candidate.heading === section.heading
    )
    if (position === -1) sections.push(section)
    else sections[position] = section

    return sections
  }
  const replacement = membershipLegalContent("unused")[0].sections
  for (const name of ["Prices, taxes and renewal", "Team API add-on"]) {
    const candidate = replacement.find((section) => section.heading === name)
    const position = sections.findIndex((section) => section.heading === name)
    if (position === -1) sections.push(candidate)
    else sections[position] = candidate
  }

  return sections
}
const apiRecordEndpoint =
  "GET /api/v1/libraries/{entityRef} returns one published record by its exact entity reference. Take entityRef from search or list results and URL-encode it as one path segment (encodeURIComponent in JavaScript), for example europe:united-kingdom:scotland:national-library-of-scotland. Unknown references return 404. Treat pagination cursors as opaque."

/** Correct only the obsolete detail endpoint in the existing API guide. */
export function apiKnowledgeBody(doc) {
  if (doc.slug !== "team-api-access") return null
  const replace = (value) => {
    if (Array.isArray(value)) return value.map(replace)
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          key === "text" && typeof child === "string"
            ? child.replace(
                "GET /api/v1/libraries/{documentId} returns one published record.",
                apiRecordEndpoint
              )
            : replace(child),
        ])
      )

    return value
  }

  return replace(stripComponentIds(doc.body ?? []))
}

export function apiKnowledgeArticle(sectionDocumentId) {
  return {
    title: "Team API access",
    slug: "team-api-access",
    summary:
      "The paid Team API add-on: public search and library records, keys, shared allowances and usage reporting. Prepared for the closed beta; production purchases are not enabled yet.",
    author: "Libraries Global Editorial Team",
    section: { connect: [{ documentId: sectionDocumentId }] },
    body: [
      {
        __component: "content.rich-text",
        body: [
          heading("Availability and price"),
          paragraph(copy.en.api),
          paragraph(
            "The API is a managed integration service over public library information. It grants no access to accounts, protected content or paid analysis tools. Public library records and individual downloads remain free."
          ),
          heading("Request endpoints"),
          paragraph(
            `Use Authorization: Bearer YOUR_API_KEY. POST /api/v1/search/libraries accepts a JSON body such as {"q":"Bristol","locale":"en","limit":20}. GET /api/v1/libraries?locale=en&limit=50 lists published records; pass meta.nextCursor as after to fetch the next page. ${apiRecordEndpoint} English is currently the only live content locale. Preserve the source licences and attribution included in responses.`
          ),
          heading("Keys and permissions"),
          paragraph(
            "The organiser creates, regenerates and revokes keys in Staff area → Team → API access and usage. The full secret appears once. A search:read key can use search; libraries:read permits the record endpoints. Regeneration immediately invalidates the old secret while retaining usage history. Members can view the dashboard but cannot manage keys or billing."
          ),
          heading("Usage and limits"),
          paragraph(
            "The default offer also limits the Team to 60 request attempts per minute, five concurrent requests and 256 KiB per response; pages contain at most 100 records. Every key shares the Team allowance. Successful responses, including cache hits, count; failures do not consume the monthly allowance but count towards the request rate. Usage resets at 00:00 UTC on the first day of each calendar month, with no rollover or automatic overage charges. Regenerating a key does not reset usage. Purchase-time limits remain attached to that subscription."
          ),
          paragraph(
            "The dashboard reports request counts, errors, response bytes, per-key and per-endpoint usage, last use and 30 days of history. Bytes measure uncompressed UTF-8 JSON; media/CDN downloads are excluded. They are not the hosting provider’s measured bandwidth. Detailed usage records are retained for 90 days. Raw keys, query text, request bodies and IP addresses are not retained in usage records."
          ),
          heading("Errors and cancellation"),
          paragraph(
            "401 means an invalid, expired or revoked key. 403 means insufficient scope or inactive Team/API access. 429 means a rate, concurrency or allowance limit. 502/503 indicates an upstream, response-size or accounting failure. Reduce page size or retry with backoff where appropriate."
          ),
          paragraph(copy.en.cancellation),
          paragraph(
            "Cancel renewal through Manage API billing. Settled API access continues to the paid period end while the Team remains active. Read the membership terms and cancellation/refund policy before purchase."
          ),
        ],
      },
    ],
  }
}
