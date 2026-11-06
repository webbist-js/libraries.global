/**
 * Staged Knowledge copy for the access model in
 * apps/docs/docs/proposals/sponsored-access-decisions.md: free Explorer,
 * earned Contributor/Supporter recognition, free Verified Staff, the paid API
 * and sponsorship. Pure data and transforms; the CMS runner is
 * `update-sponsored-access-content.mjs`, which only ever stages drafts.
 */

import { stripComponentIds } from "./cms-component-ids.mjs"
import cs from "./sponsored-access-content-cs.mjs"
import en from "./sponsored-access-content-en.mjs"
import es from "./sponsored-access-content-es.mjs"
import fr from "./sponsored-access-content-fr.mjs"

import pricing from "../../ui/src/lib/membership-pricing.json" with { type: "json" }

export const LOCALES = ["en", "fr", "cs", "es"]
const COPY = { en, fr, cs, es }

function required(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`membership-pricing.json is missing ${name}`)

  return value
}

/**
 * Access rules that the copy states. Mirrors @repo/access (recognition.ts,
 * entitlements.ts) and the API offer; tests check that they agree.
 */
export const ACCESS = {
  savedViews: 1000,
  exportRows: 10_000,
  exportsPerDay: 20,
  contributorThreshold: 1,
  supporterThreshold: 100,
  activityDays: 30,
  contributorReach: 2,
  apiReachPerHour: 20,
  apiReachPerDay: 100,
  serviceLibraries: 50,
  area4: 2500,
  span4: 75,
  area1: 20_000,
  span1: 200,
  attemptsPerMinute: 30,
  concurrent: 2,
  maxResponseKiB: 128,
  pageSize: 50,
  credits: { summary: 1, richSummary: 5, library: 5, service: 20, network: 40 },
  price: required(pricing.api?.month, "api.month"),
  requests: required(pricing.api?.included?.requests, "api.included.requests"),
  bytes: required(pricing.api?.included?.bytes, "api.included.bytes"),
  analysisCredits: required(
    pricing.api?.included?.analysisCredits,
    "api.included.analysisCredits"
  ),
  requestPence: required(
    pricing.api?.overage?.requestPence,
    "api.overage.requestPence"
  ),
  mibPence: required(pricing.api?.overage?.mibPence, "api.overage.mibPence"),
  creditPence: required(
    pricing.api?.overage?.creditPence,
    "api.overage.creditPence"
  ),
  capMinPence: required(
    pricing.api?.overage?.capMinPence,
    "api.overage.capMinPence"
  ),
  capMaxPence: required(
    pricing.api?.overage?.capMaxPence,
    "api.overage.capMaxPence"
  ),
  capStepPence: required(
    pricing.api?.overage?.capStepPence,
    "api.overage.capStepPence"
  ),
  capDefaultPence: required(
    pricing.api?.overage?.capDefaultPence,
    "api.overage.capDefaultPence"
  ),
}

const TAGS = { en: "en-GB", fr: "fr-FR", cs: "cs-CZ", es: "es-ES" }

/** Locale-formatted figures for the copy modules. */
export function accessValues(locale) {
  const number = new Intl.NumberFormat(TAGS[locale] ?? "en-GB")
  const n = (value) => number.format(value)
  const pounds = (pence) =>
    locale === "en" ? `£${n(pence / 100)}` : `${n(pence / 100)}\u00A0£`
  const rate = (pence) =>
    locale === "en"
      ? `${pence}p`
      : `${new Intl.NumberFormat(TAGS[locale], { minimumFractionDigits: 2 }).format(pence / 100)}\u00A0£`
  const a = ACCESS

  return {
    savedViews: n(a.savedViews),
    exportRows: n(a.exportRows),
    exportsPerDay: n(a.exportsPerDay),
    supporterThreshold: n(a.supporterThreshold),
    activityDays: n(a.activityDays),
    contributorReach: n(a.contributorReach),
    apiReachPerHour: n(a.apiReachPerHour),
    apiReachPerDay: n(a.apiReachPerDay),
    serviceLibraries: n(a.serviceLibraries),
    area4: `${n(a.area4)}\u00A0km²`,
    span4: `${n(a.span4)}\u00A0km`,
    area1: `${n(a.area1)}\u00A0km²`,
    span1: `${n(a.span1)}\u00A0km`,
    attemptsPerMinute: n(a.attemptsPerMinute),
    concurrent: n(a.concurrent),
    maxResponse: `${n(a.maxResponseKiB)}\u00A0KiB`,
    pageSize: n(a.pageSize),
    price: pounds(a.price),
    requests: n(a.requests),
    bytes: n(a.bytes),
    mib: `${n(a.bytes / 1024 / 1024)}\u00A0MiB`,
    credits: n(a.analysisCredits),
    requestRate: rate(a.requestPence),
    mibRate: rate(a.mibPence),
    creditRate: rate(a.creditPence),
    capMin: pounds(a.capMinPence),
    capMax: pounds(a.capMaxPence),
    capStep: pounds(a.capStepPence),
    capDefault: pounds(a.capDefaultPence),
    summaryCredits: n(a.credits.summary),
    richSummaryCredits: n(a.credits.richSummary),
    libraryReachCredits: n(a.credits.library),
    serviceReachCredits: n(a.credits.service),
    networkReachCredits: n(a.credits.network),
  }
}

export const localeCopy = (locale) => COPY[locale](accessValues(locale))

// ---------------------------------------------------------------------------
// Markdown subset → Strapi dynamic-zone components.

// Negated classes over short, editor-authored strings; no nested quantifiers.
// eslint-disable-next-line sonarjs/slow-regex
const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g

export function inline(value) {
  const children = []
  let end = 0
  for (const match of value.matchAll(INLINE)) {
    if (match.index > end)
      children.push({ type: "text", text: value.slice(end, match.index) })
    if (match[1])
      children.push({
        type: "link",
        url: match[2],
        children: [{ type: "text", text: match[1] }],
      })
    else if (match[3])
      children.push({ type: "text", text: match[3], bold: true })
    else children.push({ type: "text", text: match[4], code: true })
    end = match.index + match[0].length
  }
  if (end < value.length)
    children.push({ type: "text", text: value.slice(end) })

  return children.length ? children : [{ type: "text", text: "" }]
}

export function markdownBlocks(markdown) {
  return markdown
    .trim()
    .split(/\n\s*\n/)
    .map((chunk) => {
      const lines = chunk.split("\n").map((line) => line.trim())
      const heading = /^(#{2,3}) (.*)$/.exec(lines[0])
      if (heading && lines.length === 1)
        return {
          type: "heading",
          level: heading[1].length,
          children: inline(heading[2]),
        }
      if (lines.every((line) => line.startsWith("- ")))
        return {
          type: "list",
          format: "unordered",
          children: lines.map((line) => ({
            type: "list-item",
            children: inline(line.slice(2)),
          })),
        }
      if (lines.every((line) => /^\d+\. /.test(line)))
        return {
          type: "list",
          format: "ordered",
          children: lines.map((line) => ({
            type: "list-item",
            children: inline(line.replace(/^\d+\. /, "")),
          })),
        }

      return { type: "paragraph", children: inline(lines.join(" ")) }
    })
}

/** Rich-text and code-block components, in document order. */
export function markdownComponents(markdown) {
  const components = []
  const text = (value) => {
    if (value.trim())
      components.push({
        __component: "content.rich-text",
        body: markdownBlocks(value),
      })
  }
  let rest = markdown
  for (;;) {
    const open = rest.indexOf("```")
    const close = open === -1 ? -1 : rest.indexOf("\n```", open + 3)
    if (close === -1) break
    text(rest.slice(0, open))
    const fenced = rest.slice(open + 3, close)
    const newline = fenced.indexOf("\n")
    components.push({
      __component: "content.code-block",
      language: fenced.slice(0, newline) || "plaintext",
      code: fenced.slice(newline + 1),
      filename: null,
    })
    rest = rest.slice(close + 4)
  }
  text(rest)

  return components
}

export const nodeText = (node) =>
  Array.isArray(node)
    ? node.map(nodeText).join("")
    : typeof node?.text === "string"
      ? node.text
      : nodeText(node?.children ?? [])

// ---------------------------------------------------------------------------
// Article plan.

/**
 * Slugs this rollout renames, old → new. The site is not live, so there are
 * no redirects: the guide is found by either slug, written with the new one,
 * and links to the old path in related guides are rewritten.
 */
export const RENAMED_SLUGS = { "plans-and-pro": "plans-and-pricing" }

/** The slugs a guide may currently have in the CMS: its own, then old ones. */
export const slugsFor = (slug) => [
  slug,
  ...Object.keys(RENAMED_SLUGS).filter((old) => RENAMED_SLUGS[old] === slug),
]

/** A Knowledge link with any renamed slug replaced; other links unchanged. */
export function renamedUrl(url) {
  if (typeof url !== "string" || !url.includes("/knowledge/")) return url

  return url.replace(/\/([a-z0-9-]+)(?=[#?]|$)/, (whole, slug) =>
    RENAMED_SLUGS[slug] ? `/${RENAMED_SLUGS[slug]}` : whole
  )
}

/**
 * Canonical guides this rollout owns. `anchor` is an existing guide whose
 * section a new locale variant joins. Existing slugs are kept unless listed
 * in RENAMED_SLUGS; titles change.
 */
export const KNOWLEDGE_ARTICLES = [
  { slug: "plans-and-pricing", anchor: "plans-and-pricing", status: "stable" },
  {
    slug: "earned-recognition-and-rewards",
    anchor: "points-streaks-and-tiers",
    status: "stable",
  },
  {
    slug: "teams-for-library-services",
    anchor: "teams-for-library-services",
    status: "stable",
  },
  { slug: "the-public-api", anchor: "the-public-api", status: "beta" },
  { slug: "team-api-quickstart", anchor: "the-public-api", status: "beta" },
  { slug: "team-api-access", anchor: "the-public-api", status: "beta" },
  { slug: "team-api-reference", anchor: "the-public-api", status: "beta" },
  { slug: "api-playground", anchor: "the-public-api", status: "beta" },
  {
    slug: "api-services-submissions-and-analysis",
    anchor: "the-public-api",
    status: "beta",
  },
  {
    slug: "exporting-from-the-atlas",
    anchor: "exporting-from-the-atlas",
    status: "stable",
  },
  {
    slug: "api-cancellation-and-refunds",
    anchor: "the-public-api",
    status: "beta",
  },
  {
    slug: "deleting-an-account-with-api-access",
    anchor: "deleting-your-account",
    status: "stable",
  },
  {
    slug: "sponsoring-libraries-global",
    anchor: "plans-and-pricing",
    status: "stable",
  },
]
export const OWNED_FIELDS = ["title", "summary", "body"]
export const AUTHOR = "Libraries Global Editorial Team"
/** Editorial components kept when an owned guide is rewritten. */
const PRESERVED_COMPONENTS = new Set([
  "content.image-block",
  "content.quote-block",
  "content.callout",
])

/** Normalise a CMS read for comparison and resubmission. */
export function cleanBody(body) {
  return stripComponentIds(
    (body ?? []).map((component) =>
      component?.image && typeof component.image === "object"
        ? { ...component, image: component.image.id ?? component.image }
        : component
    )
  )
}

export function articleCopy(slug, locale) {
  const copy = localeCopy(locale).articles[slug]
  if (!copy?.title || !copy.summary || !copy.body)
    throw new Error(`Missing ${locale} copy for ${slug}`)

  return copy
}

/**
 * Owned fields for one locale variant. Existing image, quote and callout
 * components are kept unless they repeat retired copy; existing rich text and
 * code blocks are replaced because the whole guide described the old model.
 */
export function plannedArticle(slug, locale, existing) {
  const copy = articleCopy(slug, locale)
  const kept = []
  const dropped = []
  for (const component of cleanBody(existing?.body)) {
    if (
      PRESERVED_COMPONENTS.has(component.__component) &&
      !retiredCopy(component, locale).length
    )
      kept.push(component)
    else
      dropped.push({
        component: component.__component,
        heading: nodeText(component.body?.[0] ?? component.title ?? "").slice(
          0,
          120
        ),
      })
  }

  return {
    data: {
      title: copy.title,
      summary: copy.summary,
      body: [...markdownComponents(copy.body), ...kept],
    },
    dropped,
  }
}

// ---------------------------------------------------------------------------
// Retired copy: detection and scrubbing of related guides.

/** Claims from the retired paid-plan model, in any CMS locale. */
const RETIRED_PATTERNS = [
  /£\s?(?:3|5|8|15|30|50|80|96|120|480|600)(?![\d,.])/,
  /(?<![\d,.])(?<!\d[\s\u00A0\u202F])(?:3|5|8|15|30|50|80|96|120|480|600)\s?£/,
  /100[,.\s\u00A0\u202F]?000\s+(?:successful\s+)?(?:requests|requêtes|požadavků|solicitudes)/i,
  /\b10\s?(?:GiB|Gio)\b/,
  /5[,.\s\u00A0\u202F]?000(?:-|\s)?(?:points?|bodů|puntos)/i,
  /earned[- ]Pro|Pro (?:obtenu|gagné)|Obtenir Pro|Získejte Pro|získan[ýéá] Pro|Pro obtenido/i,
  /Supporter,? Pro (?:and|or|et|ou|a|ani|y|o) Team/i,
  /Team (?:seats?|plans?|API add-on)|places? Team|místa? (?:v )?Team/i,
  /seat (?:price|billing)|paid seats?|places? payantes?|placen[éá] míst|plazas? de pago/i,
  /\b(?:100) (?:new )?(?:calculations|analyses|výpočtů|calculs) (?:per|an|each|par|za) (?:hour|heure|hodinu)/i,
  /\bTeam\b[^.]{0,80}(?:excluding VAT|hors TVA|bez DPH|sin IVA|annual subscription|abonnement annuel|roční předplatné)/i,
]
/** "Pro" as a plan name. Not applied to Czech, where "pro" is a preposition. */
const PRO_PLAN = /\bPro\b/
const CS_PRO_PLAN =
  /\bPro (?:zahrnuje|přidává|nabízí|umožňuje|stojí|povoluje)|(?:členství|tarif|plán|Tarify a|Plány a|místa) Pro\b/

export function retiredMatches(value, locale) {
  const text = typeof value === "string" ? value : nodeText(value)
  const patterns = [
    ...RETIRED_PATTERNS,
    locale === "cs" ? CS_PRO_PLAN : PRO_PLAN,
  ]

  return patterns.filter((pattern) => pattern.test(text))
}

/** Text strings anywhere in a CMS value that repeat retired claims. */
export function retiredCopy(value, locale) {
  const found = []
  const walk = (node, path) => {
    if (typeof node === "string") {
      if (retiredMatches(node, locale).length) found.push({ path, text: node })
    } else if (Array.isArray(node))
      node.forEach((child, i) => walk(child, `${path}[${i}]`))
    else if (node && typeof node === "object")
      for (const [key, child] of Object.entries(node))
        if (!["url", "__component", "documentId", "id", "slug"].includes(key))
          walk(child, path ? `${path}.${key}` : key)
  }
  walk(value, "")

  return found
}

/** Rich-text sections added by earlier rollouts, removed as a whole. */
export const RETIRED_HEADINGS = new Set([
  "Earn Pro through contributions",
  "Obtenir Pro grâce aux contributions",
  "Získejte Pro za příspěvky",
  "Team prices and API access",
  "Tarifs Team et accès à l’API",
  "Ceny Team a přístup k API",
  "Supporter and Pro digital tools",
  "Delivered Atlas tools",
  "Outils Atlas disponibles",
  "Dostupné nástroje Atlasu",
  "Atlas calculation capacity",
  "Current API availability",
  "API access in the closed beta",
  "Your Team workspace",
  "L'espace de votre équipe",
  "Pracovní prostor týmu",
  "Annual billing and seat changes",
  "Facturation annuelle et places",
  "Roční fakturace a změny počtu míst",
  "Handover and unfinished Teams",
  "Transmettre la responsabilité ou abandonner une création",
  "Předání správy a nedokončené týmy",
  "If you organise a Team",
  "Si vous êtes responsable d'une équipe",
  "Pokud organizujete tým",
  "Team workspaces and billing",
  "Espaces Team et facturation",
  "Pracovní prostory Team a fakturace",
  "Membership and access",
  "Adhésion et accès",
  "Členství a přístup",
  "Staff access is independent of payment",
  "L’accès du personnel est indépendant du paiement",
  "Přístup zaměstnanců nezávisí na platbě",
])

/** Related guides scrubbed of retired copy. Unlisted guides are only reported. */
export const SCRUB_SLUGS = [
  "points-streaks-and-tiers",
  "badges",
  "how-to-contribute",
  "library-conversations",
  "suggesting-new-options",
  "connect-an-event-feed",
  "managing-event-feeds",
  "claiming-your-library",
  "staff-area",
  "plans-and-staff-access",
  "reusing-the-data",
  "change-history-on-library-pages",
  "sources-and-data-retention",
  "deleting-your-account",
  "your-account-and-profile",
  "roles-and-permissions",
  "how-review-works",
  "exploring-the-atlas",
  "understanding-library-reach",
  "atlas-population-and-context",
  "library-records-and-missing-information",
]
/** Guides that also receive the short recognition note. */
export const RECOGNITION_NOTE_SLUGS = new Set([
  "points-streaks-and-tiers",
  "badges",
  "how-to-contribute",
])

const SENTENCE = /(?<=[.!?…])\s+(?=[\p{Lu}¿¡"“„(])/u
/** Old labels from every locale; the guide's own locale wins. */
const allLinkLabels = (locale) =>
  Object.assign(
    {},
    ...LOCALES.filter((l) => l !== locale).map((l) => localeCopy(l).linkLabels),
    localeCopy(locale).linkLabels
  )

function relatedNote(locale) {
  const note = localeCopy(locale).relatedNote
  const links = []
  note.links.forEach(([label, url], i) => {
    if (i) links.push({ type: "text", text: " · " })
    links.push({ type: "link", url, children: [{ type: "text", text: label }] })
  })

  return {
    __component: "content.rich-text",
    body: [
      {
        type: "heading",
        level: 2,
        children: [{ type: "text", text: note.heading }],
      },
      { type: "paragraph", children: [{ type: "text", text: note.text }] },
      { type: "paragraph", children: links },
    ],
  }
}

const meaningful = (children) =>
  children.some(
    (child) =>
      child.type === "link" ||
      (child.type === "text" && /[\p{L}\p{N}]/u.test(child.text))
  )

/**
 * Remove retired sentences from Strapi blocks, relabel old plan links and
 * point links at renamed guides.
 */
export function scrubBlocks(blocks, locale) {
  const removed = []
  const labels = allLinkLabels(locale)
  const scrubText = (text) => {
    const kept = []
    for (const sentence of text.split(SENTENCE)) {
      if (retiredMatches(sentence, locale).length)
        removed.push({ sentence: sentence.trim() })
      else kept.push(sentence)
    }

    return kept.join(" ")
  }
  const scrubInline = (children) =>
    children
      .map((child) => {
        if (child.type === "link") {
          const label = nodeText(child).trim()
          const url = renamedUrl(child.url)
          const link = url === child.url ? child : { ...child, url }

          return labels[label]
            ? { ...link, children: [{ type: "text", text: labels[label] }] }
            : link
        }
        if (child.type === "text" && retiredMatches(child.text, locale).length)
          return { ...child, text: scrubText(child.text) }

        return child
      })
      .filter((child) => child.type !== "text" || child.text !== "")
  const scrubNode = (node) => {
    if (node.type === "list") {
      const items = node.children.map(scrubNode).filter(Boolean)

      return items.length ? { ...node, children: items } : null
    }
    if (!Array.isArray(node.children)) return node
    const children = scrubInline(node.children)

    // A heading whose whole text was retired copy is dropped with it:
    // Strapi rejects a heading without a text or link child.
    return meaningful(children) ? { ...node, children } : null
  }

  return { blocks: (blocks ?? []).map(scrubNode).filter(Boolean), removed }
}

/**
 * Remove retired sections and sentences from an existing related guide,
 * relabel old plan links and add the recognition note where listed.
 * Returns null when nothing changes. Idempotent.
 */
export function scrubbedBody(doc, locale) {
  const summary =
    doc.slug === "change-history-on-library-pages"
      ? {
          en: "What the Changes section on a library page shows, who it names, and how to read it.",
          fr: "Ce qu'affiche la section « Modifications » d'une page de bibliothèque, les personnes qui y sont mentionnées et comment la lire.",
        }[locale]
      : undefined
  const removed = []
  const original = cleanBody(doc.body)
  let body = original.filter((component) => {
    if (
      component.__component === "content.rich-text" &&
      RETIRED_HEADINGS.has(nodeText(component.body?.[0]).trim())
    ) {
      removed.push({ section: nodeText(component.body?.[0]).trim() })

      return false
    }

    return true
  })
  body = body
    .map((component) => {
      if (component.__component !== "content.rich-text") return component
      const result = scrubBlocks(component.body, locale)
      removed.push(...result.removed)

      return { ...component, body: result.blocks }
    })
    .filter(
      (component) =>
        component.__component !== "content.rich-text" ||
        component.body.some((node) => node.type !== "heading")
    )
  if (RECOGNITION_NOTE_SLUGS.has(doc.slug)) {
    const note = relatedNote(locale)
    const heading = nodeText(note.body[0])
    const position = body.findIndex(
      (component) =>
        component.__component === "content.rich-text" &&
        nodeText(component.body?.[0]) === heading
    )
    if (position === -1) body.push(note)
    else body[position] = note
  }
  const revisedSummary = summary && doc.summary !== summary ? summary : null
  if (JSON.stringify(body) === JSON.stringify(original) && !revisedSummary)
    return null

  return { body, removed, ...(revisedSummary ? { summary: revisedSummary } : {}) }
}
