/** Local CMS migration. Run with --experimental-transform-types; preview by default. */
import { randomUUID } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { parseEnv } from "node:util"

import {
  billingCookiesSection,
  billingKnowledgeSections,
  billingPrivacySection,
  membershipLegalContent,
} from "./billing-content.mjs"
import { StrapiMcpClient } from "./mcp-client.ts"
import { pricingGuideBody } from "./team-pricing-content.mjs"

const source = parseEnv(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
)
const url = process.env.STRAPI_URL || "http://127.0.0.1:1337"
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url))
  throw new Error("Local CMS migration only")
const apply = process.argv.includes("--apply")
const legalOnly = process.argv.includes("--legal-only")
const client = new StrapiMcpClient(source.STRAPI_MCP_TOKEN, `${url}/mcp`)
await client.initialize()
const clean = (value) =>
  Array.isArray(value)
    ? value.map(clean)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key, v]) => key !== "id" && v !== null)
            .map(([key, v]) => [key, clean(v)])
        )
      : value
const textOf = (block) =>
  (block.children ?? []).map((x) => x.text ?? "").join("")
const paragraph = (text) => ({
  type: "paragraph",
  children: [{ type: "text", text }],
})
const revision = {
  version: "1.1",
  date: "2026-10-13",
  summary:
    "Team pricing and the separate API add-on, usage limits and billing; personal founding prices and service-seller responsibilities remain unchanged.",
}
const legal = await client.listAll("legal-document", {
  locale: "en",
  status: "draft",
})
const knowledge = {}
for (const locale of legalOnly ? [] : ["en", "fr", "cs"])
  knowledge[locale] = await client.listAll("wiki-article", {
    locale,
    status: "draft",
  })
if (apply)
  writeFileSync(
    `/tmp/libraries-billing-cms-before-${randomUUID()}.json`,
    JSON.stringify({ legal, knowledge }),
    { mode: 0o600 }
  )
const publishExisting = async (type, doc, locale, data) => {
  if (apply) {
    await client.call(`update_${type}`, {
      documentId: doc.documentId,
      locale,
      data,
    })
    if (["published", "modified"].includes(doc.status))
      await client.call(`publish_${type}`, {
        documentId: doc.documentId,
        locale,
      })
  }
  console.log(`${apply ? "Updated" : "Preview"} ${locale}: ${doc.slug}`)
}
for (const doc of (legalOnly ? [] : legal).filter((d) =>
  ["privacy", "cookies", "terms"].includes(d.slug)
)) {
  let sections = clean(doc.sections ?? [])
  const replacement =
    doc.slug === "privacy"
      ? billingPrivacySection
      : doc.slug === "cookies"
        ? billingCookiesSection
        : {
            heading: "Donations and paid features",
            inShort:
              "Optional memberships buy digital tools, never trust or staff access.",
            body: [
              paragraph(
                "Ko-fi donations remain separate and are subject to Ko-fi's payment terms. They do not buy membership tools, points, roles or influence. Supporter and Pro are optional recurring digital memberships processed by Stripe Managed Payments. Read /legal/membership and /legal/cancellation-refunds before paying; those terms supplement these general terms and preserve statutory consumer rights."
              ),
              paragraph(
                "Library records, individual downloads, contributions and following remain free. Paid membership does not alter moderation, earned points or staff permissions. Payment and access notices are essential service communications; membership does not enrol you in optional emails."
              ),
            ],
          }
  const index = sections.findIndex((s) => s.heading === replacement.heading)
  if (index !== -1) sections[index] = replacement
  else sections.push(replacement)
  const revisions = clean(doc.revisions ?? []).filter(
    (r) => r.version !== revision.version && r.version !== revision.date
  )
  revisions.push(revision)
  await publishExisting("legal-document", doc, "en", {
    title: doc.title,
    slug: doc.slug,
    sections,
    revisions,
  })
}
// Public postal details must be supplied explicitly, never copied from private mail configuration.
const operator =
  process.env.BILLING_LEGAL_OPERATOR ||
  source.BILLING_LEGAL_OPERATOR ||
  "Alexander Bennett, an independent developer in England"
const postal =
  (
    process.env.BILLING_LEGAL_POSTAL_ADDRESS ||
    source.BILLING_LEGAL_POSTAL_ADDRESS
  )?.trim() || undefined
const contactEmail =
  process.env.BILLING_LEGAL_EMAIL ||
  source.BILLING_LEGAL_EMAIL ||
  "info@libraries.global"
for (const data of membershipLegalContent(operator, postal, contactEmail)) {
  const existing = legal.find((d) => d.slug === data.slug)
  if (apply && !postal && ["published", "modified"].includes(existing?.status))
    throw new Error(
      "Supply the public postal address before updating published membership policies"
    )
  if (apply) {
    const result = await client.call(
      existing ? "update_legal-document" : "create_legal-document",
      {
        ...(existing ? { documentId: existing.documentId } : {}),
        locale: "en",
        data: {
          ...data,
          revisions: [
            ...clean(existing?.revisions ?? []).filter(
              (r) =>
                r.version !== revision.version && r.version !== revision.date
            ),
            revision,
          ],
        },
      }
    )
    const documentId = existing?.documentId ?? result.data?.documentId
    if (!documentId) throw new Error("Legal document reference missing")
    if (postal)
      await client.call("publish_legal-document", { documentId, locale: "en" })
  }
  console.log(
    `${apply ? (postal ? "Published" : "Drafted") : "Preview"} legal: ${data.slug}`
  )
}

const localized = {
  en: billingKnowledgeSections,
  fr: [
    paragraph(
      "Supporter : 3 £ par mois ou 30 £ par an. Cette formule comprend l'historique détaillé des modifications et les exports Atlas CSV/GeoJSON, jusqu'à 500 bibliothèques par téléchargement. Pro : tarif fondateur de 5 £ par mois ou 50 £ par an, avec ces outils, des exports jusqu'à 10 000 bibliothèques et les comparaisons de desserte par rapport à la population. Les outils inachevés restent indiqués « À venir ». Team fait l'objet d'un devis distinct."
    ),
    paragraph(
      "Les fiches, les téléchargements individuels, les contributions, le suivi, les événements enregistrés et les deux emails hebdomadaires facultatifs restent gratuits. Le paiement n'accorde ni confiance, ni points, ni rôle, ni droits de modération ou d'accès au personnel."
    ),
    paragraph(
      "Choisissez une formule et connectez-vous à un compte dont l'email est vérifié. Lisez les conditions d'adhésion puis continuez vers le paiement sécurisé de Stripe. Stripe confirme la taxe, la devise et le montant récurrent, et propose les cartes ainsi qu'Apple Pay/Google Pay lorsqu'ils sont disponibles. Si la confirmation tarde, consultez la facturation avant de payer à nouveau."
    ),
    paragraph(
      "Paramètres → Adhésion et facturation affiche l'adhésion payante séparément de l'accès actuel : les contributions, la vérification, les subventions ou une place Team peuvent aussi donner Pro. Stripe permet de gérer les coordonnées, les factures et l'arrêt du renouvellement. Tout changement affiche son montant exact et sa date d'effet avant confirmation. Les formules inférieures et les intervalles plus courts sont vérifiés dans les paramètres, sans débit aujourd’hui, et prennent effet à la fin de la période payée. Utilisez Annuler le changement programmé avant son début. Pour un changement créé dans le portail Stripe : Update subscription → Cancel change."
    ),
    paragraph(
      "Une mise à niveau impayée ne donne aucun nouvel outil et conserve la période Supporter déjà réglée. Un renouvellement échoué peut bénéficier d'un délai de sept jours à partir du premier échec, sans remise à zéro lors des nouvelles tentatives. La suppression du compte arrête d'abord la facturation et est refusée si cet arrêt ne peut pas être confirmé."
    ),
    paragraph(
      "L'arrêt du renouvellement et une demande de remboursement sont distincts. Consultez les conditions d'adhésion et la politique d'annulation/remboursement en anglais à /legal/membership et /legal/cancellation-refunds. Vos droits légaux restent inchangés. Les montants GBP de base incluent les taxes applicables ; Stripe confirme le montant réellement payé."
    ),
    paragraph(
      "Le signe Supporter et le crédit public sont des choix indépendants dans Confidentialité. Les profils privés ou à visibilité limitée ne figurent jamais dans la liste publique. L'adhésion ne vous abonne pas aux newsletters ni aux emails marketing."
    ),
  ],
  cs: [
    paragraph(
      "Supporter stojí 3 £ měsíčně nebo 30 £ ročně. Zahrnuje podrobnou historii změn a exporty Atlasu do CSV/GeoJSON, nejvýše 500 knihoven na stažení. Pro za zakládající cenu 5 £ měsíčně nebo 50 £ ročně zahrnuje stejné nástroje, export až 10 000 knihoven a porovnání dostupnosti knihoven podle počtu obyvatel. Nedokončené nástroje zůstávají označené „Již brzy“. Team má samostatnou nabídku."
    ),
    paragraph(
      "Záznamy, jednotlivá stažení, příspěvky, sledování, uložené události a oba volitelné týdenní emaily zůstávají zdarma. Platba nepřidává důvěru, body, roli, oprávnění k moderování ani přístup zaměstnanců."
    ),
    paragraph(
      "Vyberte tarif a přihlaste se k účtu s ověřeným emailem. Přečtěte si podmínky členství a pokračujte k zabezpečené platbě Stripe. Stripe potvrdí daň, měnu a opakovanou částku a nabídne karty i Apple Pay/Google Pay, pokud jsou dostupné. Při zpožděném potvrzení zkontrolujte fakturaci, než zaplatíte znovu."
    ),
    paragraph(
      "Nastavení → Členství a fakturace ukazuje placené členství odděleně od aktuálního přístupu: příspěvky, ověření, granty či místo v Team mohou také poskytovat Pro. Ve Stripe lze spravovat údaje, faktury a zrušení obnovování. Změna tarifu před potvrzením ukáže přesnou částku a datum. Nižší tarif či kratší interval se kontroluje v nastavení, dnes se nic neúčtuje a změna začne po konci zaplaceného období. Použijte Zrušit naplánovanou změnu před jejím začátkem. U změny vytvořené v portálu Stripe: Update subscription → Cancel change."
    ),
    paragraph(
      "Nezaplacený přechod na vyšší tarif neposkytne nové nástroje a zachová již zaplacené období Supporter. Neúspěšné obnovení může mít sedmidenní toleranci od prvního selhání; další pokusy ji neobnovují. Smazání účtu nejdříve zastaví fakturaci a je odmítnuto, pokud zastavení nelze potvrdit."
    ),
    paragraph(
      "Zastavení obnovování a žádost o vrácení peněz jsou různé kroky. Přečtěte si anglické podmínky členství a pravidla zrušení/vrácení peněz na /legal/membership a /legal/cancellation-refunds. Zákonná práva zůstávají zachována. Základní ceny v GBP zahrnují příslušnou daň; skutečně placenou částku potvrzuje Stripe."
    ),
    paragraph(
      "Značka Supporter a veřejné poděkování jsou samostatné volby v Soukromí. Soukromé či omezené profily se nikdy nezobrazují ve veřejném seznamu. Členství vás nepřihlásí k newsletterům ani marketingovým emailům."
    ),
  ],
}
for (const [locale, docs] of Object.entries(knowledge)) {
  for (const doc of docs.filter((d) =>
    [
      "plans-and-pro",
      "plans-and-staff-access",
      "your-account-and-profile",
      "deleting-your-account",
      "change-history-on-library-pages",
    ].includes(d.slug)
  )) {
    const body = clean(doc.body ?? [])
    if (doc.slug === "plans-and-pro") {
      const blocks =
        body.find((c) => c.__component === "content.rich-text")?.body ?? []
      const headings = blocks
        .map((b, i) => (b.type === "heading" ? i : -1))
        .filter((i) => i >= 0)
      const grants =
        headings.length >= 6 ? blocks.slice(headings[3], headings[4]) : []
      const rich = body.find((c) => c.__component === "content.rich-text")
      if (rich) rich.body = [...localized[locale], ...grants]
    } else if (
      doc.slug === "plans-and-staff-access" ||
      doc.slug === "change-history-on-library-pages"
    ) {
      // Replace only billing paragraphs; preserve staff/attribution instructions.
      for (const c of body)
        if (c.__component === "content.rich-text") {
          if (doc.slug === "plans-and-staff-access") {
            c.body[0] = localized[locale][0]
            c.body = c.body.filter(
              (b) =>
                !/placeholder prices|prix indicatifs|zástupné ceny/.test(
                  textOf(b)
                )
            )
          }
          if (doc.slug === "change-history-on-library-pages") {
            for (const b of c.body)
              for (const child of b.children ?? [])
                if (child.type === "text")
                  child.text = child.text
                    .replaceAll("Pro or Team", "Supporter, Pro or Team")
                    .replaceAll("Pro and Team", "Supporter, Pro and Team")
          }
        }
    }
    // Idempotent guide section on pages that otherwise retain their existing content.
    if (doc.slug !== "plans-and-pro") {
      const marker = "Supporter and Pro digital tools"
      const index = body.findIndex(
        (c) =>
          c.__component === "content.rich-text" &&
          textOf(c.body?.[0] ?? {}) === marker
      )
      const extra = {
        __component: "content.rich-text",
        body: [
          {
            type: "heading",
            level: 2,
            children: [{ type: "text", text: marker }],
          },
          ...localized[locale],
        ],
      }
      if (index !== -1) body[index] = extra
      else body.push(extra)
    }
    await publishExisting("wiki-article", doc, locale, {
      title: doc.title,
      slug: doc.slug,
      body: pricingGuideBody({ ...doc, body }, locale) ?? body,
    })
  }
}
