# Beta entrance and standard legal pages

The beta entrance links to `/legal/beta`, a temporary CMS document covering invitation access, access-request privacy, feedback and essential cookies. The waitlist links directly to `/legal/beta#privacy`. Labels and paths use the visitor's locale; the document currently uses the existing English content fallback for Czech and French.

The notice supplements the standard site policies. It does not replace account terms, membership terms or cancellation/refund rights. Standard legal URLs remain readable without the beta password, including links in existing emails.

## Layout and navigation

With `BETA_GATE_ENABLED=true`, requests without a valid signed `lg-beta-access` cookie use the minimal beta shell on the exact public legal URLs. Legal pages in that shell receive the small project footer, linking to the beta notice, privacy section, contact and source. The beta entrance has the same footer.

After entry, legal pages use the normal site providers, header and footer. The proxy validates the signed beta pass before choosing this layout and strips client-supplied `x-beta-public-shell` flags. Invalid or expired passes keep the public shell; they do not unlock protected pages or APIs. Beta access is separate from an account session or paid entitlement.

`fetchLegalDocuments()` excludes slug `beta` from standard legal tabs, the site footer and static legal navigation. The beta detail remains directly readable, with its own document view. Its metadata always requests no indexing. The beta footer and waitlist links use native anchors, and successful beta entry performs a full navigation so cached public layouts do not survive entry.

## CMS publication

The approved public operator details come from `BILLING_LEGAL_OPERATOR`, `BILLING_LEGAL_POSTAL_ADDRESS` and `BILLING_LEGAL_EMAIL` in the private Strapi environment. The script requires all three and never prints them or copies private mail configuration automatically.

From the repository root:

```sh
node --experimental-transform-types apps/strapi/scripts/update-beta-legal.mjs
node --experimental-transform-types apps/strapi/scripts/update-beta-legal.mjs --apply
```

The first command previews. The second backs up the existing beta document to a private temporary file, creates or updates only slug `beta` through Strapi MCP and publishes its English version. It does not change the standard legal documents or their revision history. The endpoint is restricted to the local Strapi service.

Edit the notice when the entrance, waitlist or data practices change. For an ordinary content revision, use a new version/date and retain the previous revision. Review waitlist records when invitations end; remove data no longer needed and retain only necessary withdrawal/suppression evidence. Provider-held records need their own deletion controls, as stated in the privacy notice.

Revision identifiers are numbers such as `1.0`; publication dates have their own field. The current beta, terms, privacy, cookies, membership and cancellation/refund releases are version 1.0, dated 12 October 2026. `normalize-legal-versions.mjs` corrects the earlier date-based identifiers through MCP without changing policy copy or recorded consents. Run it with `node --experimental-transform-types apps/strapi/scripts/normalize-legal-versions.mjs` to preview, then add `--apply` to update and republish the affected documents. It backs up existing records and refuses to publish documents with unrelated pending edits. The publication scripts also use numbered versions so a rerun cannot restore the mistaken labels.

## Retiring the gate

Set `BETA_GATE_ENABLED=false` in the deployed frontend when public access opens. All legal pages then use the normal site layout. The entrance redirects into the site, so its beta legal links disappear. Keep `/legal/beta` published and excluded from main navigation as an archived reference for earlier invitations; do not leave email or saved links broken.

## Verification

Regression coverage checks accepted, forged and expired passes; exact GET/HEAD legal exceptions; rendered site-footer restoration; absence of site-footer reads before entry; localized beta links; and exclusion of the beta notice from standard navigation, including locale fallback. Run:

```sh
pnpm --filter @repo/ui test src/lib/proxies/__tests__/betaGate.test.ts 'src/app/[locale]/__tests__/layout-locale.test.tsx' src/lib/strapi-api/content/__tests__/legal-navigation.test.ts src/components/beta/__tests__/BetaFooter.test.tsx src/components/global/__tests__/GlobalHeader-public.test.tsx
pnpm --filter @repo/ui typecheck
```

The frontend dev server was intentionally left stopped at the user's request. Source/render tests and the production build can run without restarting it.

Verified on 12 October 2026: all 44 focused checks passed, frontend typechecking passed, scoped lint had no errors, and the isolated production build completed all 259 pages. The published English CMS detail matched the notice text and approved contact details through the read-only endpoint.
