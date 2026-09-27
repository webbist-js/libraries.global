import type { Core } from "@strapi/strapi"

/**
 * Starter copy for the four legal documents, created as DRAFTS on first boot
 * so editors get the structure pre-filled. This is placeholder text — it must
 * be replaced with counsel-reviewed copy before anything is published.
 */

type TextNode = {
  type: "text"
  text: string
  bold?: boolean
}
type LinkNode = { type: "link"; url: string; children: TextNode[] }
type InlineNode = TextNode | LinkNode
type Block =
  | { type: "paragraph"; children: InlineNode[] }
  | {
      type: "list"
      format: "unordered"
      children: { type: "list-item"; children: InlineNode[] }[]
    }

const text = (value: string, bold = false): TextNode =>
  bold ? { type: "text", text: value, bold } : { type: "text", text: value }

const p = (...children: (string | InlineNode)[]): Block => ({
  type: "paragraph",
  children: children.map((c) => (typeof c === "string" ? text(c) : c)),
})

const list = (...items: InlineNode[][]): Block => ({
  type: "list",
  format: "unordered",
  children: items.map((children) => ({ type: "list-item", children })),
})

const link = (url: string, label: string): LinkNode => ({
  type: "link",
  url,
  children: [text(label)],
})

type SeedDocument = {
  title: string
  slug: string
  navLabel: string
  heroTitle: string
  lead: string
  order: number
  summaryPoints: { text: string }[]
  sections: { heading: string; inShort: string; body: Block[] }[]
}

const CC_BY_SA = "https://creativecommons.org/licenses/by-sa/4.0/"

export const LEGAL_SEED: SeedDocument[] = [
  {
    title: "Terms of use",
    slug: "terms",
    navLabel: "Terms of use",
    heroTitle: "Terms *of use.*",
    lead: "The agreement between you and the Libraries Global project when you browse, contribute to or reuse the index.",
    order: 1,
    summaryPoints: [
      {
        text: "Browsing and reusing library records is free and needs no account.",
      },
      {
        text: "What you contribute is published under an open licence and credited to you.",
      },
      {
        text: "Be accurate, cite sources, and don’t claim to represent a library unless you do.",
      },
    ],
    sections: [
      {
        heading: "Who we are",
        inShort:
          "Libraries Global is an independent, open-source project run by volunteers.",
        body: [
          p(
            "Libraries Global (“the project”, “we”) is an independent, community-maintained index of the world’s libraries. The code is open source, and the project is not affiliated with, or endorsed by, any library or institution listed in the index."
          ),
          p(
            "These terms apply to the website, the atlas, the API and any data exports we publish."
          ),
        ],
      },
      {
        heading: "Using the index",
        inShort:
          "Anyone can browse, search and read every record, with or without an account.",
        body: [
          p(
            "You may browse, search and read the index without creating an account. Some features, such as following libraries or suggesting edits, need a free account. Analysis tools in the atlas are part of the optional Pro plan."
          ),
          p(
            "Library facts, including names, locations, opening hours and accessibility details, will always be free to view."
          ),
        ],
      },
      {
        heading: "Contributing",
        inShort:
          "Your edits are reviewed, published under an open licence and credited to you.",
        body: [
          p(
            "When you suggest an edit, add a library or upload a photograph, you confirm that it is accurate to the best of your knowledge and that you have the right to share it."
          ),
          p(
            "Text and data contributions are published under ",
            link(CC_BY_SA, "CC BY-SA 4.0"),
            ". Photographs are published under the licence you choose when you upload them. Your display name is shown alongside your contributions in the revision history."
          ),
        ],
      },
      {
        heading: "Institutional stewardship",
        inShort:
          "Claiming a record doesn’t make you its official representative. Stewardship is verified separately.",
        body: [
          p(
            "Library staff can request stewardship of their library’s record. We verify each request with the institution directly. Until a request is verified, the record stays community maintained."
          ),
          p(
            "A steward can highlight official information, but cannot remove accurate community contributions or their revision history."
          ),
        ],
      },
      {
        heading: "Acceptable use",
        inShort:
          "Don’t add false, misleading or harmful content, or scrape the site in ways that harm it.",
        body: [
          p(
            "Don’t submit information you know is false, impersonate a person or institution, harass other contributors, or add content that infringes someone else’s rights."
          ),
          p(
            "Automated access should use the public API and respect its rate limits. We may limit or suspend accounts that break these terms, and we explain why when we do."
          ),
        ],
      },
      {
        heading: "Liability",
        inShort:
          "We work hard to keep records accurate, but you should check before you travel.",
        body: [
          p(
            "The index is provided “as is”. Opening hours and services change, so please confirm important details with the library before visiting. To the extent the law allows, the project is not liable for losses arising from reliance on the index."
          ),
        ],
      },
    ],
  },
  {
    title: "Privacy policy",
    slug: "privacy",
    navLabel: "Privacy",
    heroTitle: "Privacy *policy.*",
    lead: "What personal information we collect, why, how long we keep it, and the choices you have.",
    order: 2,
    summaryPoints: [
      {
        text: "No advertising, no third-party tracking and no selling of data.",
      },
      {
        text: "Your email is never shown publicly. You choose what your profile displays.",
      },
      {
        text: "You can download or delete your account data at any time from Settings.",
      },
    ],
    sections: [
      {
        heading: "What we collect",
        inShort: "Your email, a display name, and the contributions you make.",
        body: [
          p(
            "If you create an account, we store your email address, a display name and, if you choose to add them, a short bio, location and affiliations. We store the edits, photographs and sources you contribute, and when you made them."
          ),
          p(
            "If you browse without an account, we keep anonymous server logs for up to 14 days to keep the service secure."
          ),
        ],
      },
      {
        heading: "What we don’t do",
        inShort: "No ads, no tracking pixels, no data sales.",
        body: [
          p(
            "We don’t show advertising, use third-party analytics or tracking pixels, or sell or rent personal data to anyone."
          ),
        ],
      },
      {
        heading: "Public by design",
        inShort:
          "Contributions and your display name are public. Your email never is.",
        body: [
          p(
            "Because the index is an open record, your display name appears in the revision history of anything you contribute. Everything else on your profile is private unless you choose to make it public in Settings."
          ),
        ],
      },
      {
        heading: "Who processes data",
        inShort:
          "A small number of providers help run the service, under written agreements.",
        body: [
          p(
            "We use a hosting provider in the EU, an email delivery service, and a payment provider for Pro subscriptions. Payment card details go directly to the payment provider; we never see or store them."
          ),
        ],
      },
      {
        heading: "Your rights",
        inShort:
          "See, correct, download or delete your data whenever you like.",
        body: [
          p(
            "You can view and correct your information in Settings, download a copy of your data, or delete your account. Deleting your account removes your personal details. Your past contributions stay in the public record, credited to “Former contributor”."
          ),
          p(
            "You can also contact us to exercise any right you have under data protection law, including the UK GDPR and EU GDPR."
          ),
        ],
      },
      {
        heading: "How long we keep it",
        inShort: "Only as long as it’s needed.",
        body: [
          p(
            "Account data is kept while your account is active. Server logs are deleted after 14 days. Backups are rotated every 30 days."
          ),
        ],
      },
    ],
  },
  {
    title: "Data licence",
    slug: "data-licence",
    navLabel: "Data licence",
    heroTitle: "Data *licence.*",
    lead: "What you may do with the records, exports and API responses we publish, and how to credit them.",
    order: 3,
    summaryPoints: [
      {
        text: "You can copy, share and build on the records, including commercially.",
      },
      {
        text: "Credit Libraries Global contributors and share adapted data under the same licence.",
      },
      { text: "Photographs keep the licence their uploader chose." },
    ],
    sections: [
      {
        heading: "What the licence covers",
        inShort: "Library records, bulk exports and API responses.",
        body: [
          p(
            "Library records in the index, including names, addresses, coordinates, opening hours, services, accessibility details and collection statistics, are published under the Creative Commons Attribution-ShareAlike 4.0 licence (",
            link(CC_BY_SA, "CC BY-SA 4.0"),
            "). The same licence applies to bulk exports and to data returned by the public API."
          ),
          p(
            "The project’s source code is licensed separately, under the licence in its repository."
          ),
        ],
      },
      {
        heading: "Crediting us",
        inShort: "Say where the data came from and link back.",
        body: [
          p(
            "When you reuse the data, credit “Libraries Global contributors” and link to the index or to the record you used. If you changed the data, say so."
          ),
        ],
      },
      {
        heading: "Sharing alike",
        inShort: "Publish adapted data under the same licence.",
        body: [
          p(
            "If you publish an adapted version of the data, release it under CC BY-SA 4.0 or a compatible licence, so others can reuse it on the same terms."
          ),
        ],
      },
      {
        heading: "Imported sources",
        inShort: "Some records started life in other open datasets.",
        body: [
          p(
            "Some records were first imported from open datasets published by governments and library services. Where a source uses a different open licence, its terms also apply to the fields we imported from it."
          ),
        ],
      },
      {
        heading: "Photographs",
        inShort: "Each photo carries its own licence.",
        body: [
          p(
            "Photographs are published under the licence chosen by the person who uploaded them, shown next to each image. Check it before you reuse a photo."
          ),
        ],
      },
      {
        heading: "No warranty",
        inShort: "The data is offered as it is.",
        body: [
          p(
            "We don’t guarantee that the data is complete or current. The liability section of the terms of use applies to reuse of the data too."
          ),
        ],
      },
    ],
  },
  {
    title: "Cookie policy",
    slug: "cookies",
    navLabel: "Cookies",
    heroTitle: "Cookie *policy.*",
    lead: "The small files this site stores in your browser, what each one does, and how to control them.",
    order: 4,
    summaryPoints: [
      { text: "We only use cookies the site needs to work." },
      {
        text: "No advertising or tracking cookies, so there’s no consent banner to click through.",
      },
      {
        text: "Blocking cookies won’t stop you browsing, but you need them to sign in.",
      },
    ],
    sections: [
      {
        heading: "What cookies are",
        inShort: "Small files a website stores in your browser.",
        body: [
          p(
            "A cookie is a small text file that a website saves in your browser so it can remember something between pages or visits. We also use similar browser storage for a few interface preferences, such as filters you’ve collapsed."
          ),
        ],
      },
      {
        heading: "Cookies we use",
        inShort: "Sign-in, language, and editor preview.",
        body: [
          list(
            [
              text("Session", true),
              text(
                " keeps you signed in. It’s set when you sign in and removed when you sign out."
              ),
            ],
            [
              text("Language", true),
              text(" remembers the language you chose for the site."),
            ],
            [
              text("Preview", true),
              text(
                " lets editors see unpublished changes. It’s only ever set for editors."
              ),
            ]
          ),
        ],
      },
      {
        heading: "What we don’t use",
        inShort: "No advertising, analytics or social media cookies.",
        body: [
          p(
            "We don’t use advertising cookies, third-party analytics or social media trackers, so there’s nothing to opt into."
          ),
        ],
      },
      {
        heading: "Controlling cookies",
        inShort: "Your browser settings decide.",
        body: [
          p(
            "You can view and delete cookies in your browser settings. If you block the session cookie you can still browse and search the index, but you won’t be able to sign in or contribute."
          ),
        ],
      },
    ],
  },
]

const UID = "api::legal-document.legal-document"

/** Create the legal documents as drafts when none exist yet (idempotent). */
export async function seedLegalDocuments(strapi: Core.Strapi) {
  const existing = await strapi.documents(UID).count({})
  if (existing > 0) return

  const today = new Date().toISOString().slice(0, 10)

  for (const doc of LEGAL_SEED) {
    await strapi.documents(UID).create({
      data: {
        ...doc,
        revisions: [
          { version: "1.0", date: today, summary: "First published version." },
        ],
        // The seed's block shapes are narrower than Strapi's BlocksValue union.
      } as any,
    })
  }

  strapi.log.info(
    `[legal] Created ${LEGAL_SEED.length} draft legal documents with placeholder copy — replace with reviewed text before publishing`
  )
}
