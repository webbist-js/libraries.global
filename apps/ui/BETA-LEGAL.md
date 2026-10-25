# Beta entrance and standard legal pages

The beta entrance links to `/legal/beta`, a temporary CMS document covering invitation access, access-request privacy, feedback and essential cookies. The waitlist links directly to `/legal/beta#privacy`. Labels and paths use the visitor's locale; the document currently uses the existing English content fallback for Czech and French.

The notice supplements the standard site policies. It does not replace account terms, membership terms or cancellation/refund rights. Standard legal URLs remain readable without a beta invitation pass, including links in existing emails.

## Layout and navigation

With `BETA_GATE_ENABLED=true`, requests without a valid signed `lg-beta-access` cookie use the minimal beta shell on the exact public legal URLs. Legal pages in that shell receive the small project footer, linking to the beta notice, privacy section, contact and source. The beta entrance has the same footer.

After entry, legal pages use the normal site providers, header and footer. The proxy validates the signed beta pass before choosing this layout and strips client-supplied `x-beta-public-shell` flags. Invalid or expired passes keep the public shell; they do not unlock protected pages or APIs. Beta access is separate from an account session or paid entitlement.

`fetchLegalDocuments()` excludes slug `beta` from standard legal tabs, the site footer and static legal navigation. The beta detail remains directly readable, with its own document view. Its metadata always requests no indexing. The beta footer and waitlist links use native anchors, and successful beta entry performs a full navigation so cached public layouts do not survive entry.

## CMS publication

Public operator details come from `BILLING_LEGAL_OPERATOR`, `BILLING_LEGAL_POSTAL_ADDRESS` and `BILLING_LEGAL_EMAIL` in the private Strapi environment. The script requires all three and never prints them or copies private mail configuration automatically.

The `update-beta-legal.mjs` helper is a local feature migration. For routine production revisions, follow [CMS content operations](../strapi/CONTENT-OPERATIONS.md). To inspect the local migration, run from the repository root:

```sh
node --experimental-transform-types apps/strapi/scripts/update-beta-legal.mjs
node --experimental-transform-types apps/strapi/scripts/update-beta-legal.mjs --apply
```

The first command previews. The second backs up the existing beta document to a private temporary file, creates or updates only slug `beta` through Strapi MCP and publishes its English version. It does not change the standard legal documents or their revision history. The endpoint is restricted to the local Strapi service.

Edit the notice when the entrance, waitlist or data practices change. For an ordinary content revision, use a new version/date and retain the previous revision. Review waitlist records when invitations end; remove data no longer needed and retain only necessary withdrawal/suppression evidence. Provider-held records need their own deletion controls, as stated in the privacy notice.

Revision identifiers are numbers such as `1.0`; publication dates have their own field. Check the selected CMS document and current content/consent constants for the revision required by a release. Policy document revisions, purchase offer consent and historical recorded acceptance are separate; do not overwrite historical consent when publishing descriptive changes.

`normalize-legal-versions.mjs` is a local correction tool for earlier date-based identifiers. Review its target records before applying it; it does not determine the current production revision. Preserve unrelated drafts and revision history through the content operations workflow.

## Retiring the gate

Set `BETA_GATE_ENABLED=false` in the deployed frontend when public access opens. All legal pages then use the normal site layout. The entrance redirects into the site, so its beta legal links disappear. Keep `/legal/beta` published and excluded from main navigation as an archived reference for earlier invitations; do not leave email or saved links broken.

## Verification

Regression coverage checks accepted, forged and expired passes; exact GET/HEAD legal exceptions; rendered site-footer restoration; absence of site-footer reads before entry; localized beta links; and exclusion of the beta notice from standard navigation, including locale fallback. Run:

```sh
pnpm --filter @repo/ui test src/lib/proxies/__tests__/betaGate.test.ts 'src/app/[locale]/__tests__/layout-locale.test.tsx' src/lib/strapi-api/content/__tests__/legal-navigation.test.ts src/components/beta/__tests__/BetaFooter.test.tsx src/components/global/__tests__/GlobalHeader-public.test.tsx
pnpm --filter @repo/ui typecheck
```

Individual beta invitations store issuance, delivery and redemption records against the access request. The beta cookie references the accepted invitation, so operators can revoke that browser pass. See `../strapi/BETA-INVITES.md` for the current access and correspondence workflow.
