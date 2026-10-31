# Dark mode editorial bundle

Published and verified in production on 30 October 2026: the English Journal preview and four **Design system** articles. The copy explicitly describes dark mode as forthcoming. See the [publication record and live links](./publication-status.md). The reading proof remains an offline source artifact.

## Review

- [Journal preview](./journal.md)
- [Update: How the site is designed](./how-the-site-is-designed.md)
- [New: Colour and appearance](./colour-and-appearance.md)
- [New: Accessible interfaces and interaction](./accessible-interface-interaction.md)
- [New: Shared components and section identity](./shared-components-and-section-identity.md)
- [Asset and editorial manifest](./manifest.json)
- [Offline reading preview](../preview.html)

The Journal comparison images are captures of the implemented development UI, including labelled demonstration stories. The homepage image is a development UI excerpt. Each has distinct provenance, alt text and a publishable caption. No screenshot establishes that dark mode or its controls have shipped. The source HTML is not included in this bundle and must not be copied into article rich text.

## Rebuild and validate offline

From the repository root:

```sh
node apps/docs/docs/proposals/dark-mode/editorial/build-bundle.mjs
node --test apps/docs/docs/proposals/dark-mode/editorial/build-bundle.test.mjs
```

The builder has no network, credential or CMS-write path. It validates this deliberately small Markdown subset, converts text to Strapi Blocks AST and generates a review JSON and an HTML reading preview. Markdown source is the editorial source of truth. Re-run after editing it. The preview is a reading proof, not a screenshot of the production article renderer.

`review-bundle.json` contains explicit `imageAsset` references and **must not be sent directly to the CMS**. The exported `buildArticlePayload` resolves those references only with uploaded numeric media IDs and a production section document ID; it refuses missing media. Updating the existing design article emits only body, summary and reading time, preserving title, author, section, SEO, media and other metadata.

## Production publication handoff

Use the existing approved editorial connection and the [CMS content operations rules](../../../../../strapi/CONTENT-OPERATIONS.md). This copy may be published before the appearance feature because it clearly states its preview status. It does not relax any infrastructure or feature-release gate.

1. Read the production English published and draft records for all five slugs, plus the `design-system` Knowledge and `from-the-index` Journal sections. Resolve relations by production slug; never reuse IDs from local snapshots. Confirm the existing design article still exists and inspect its current copy before replacing its body. If production has meaningful changes beyond the reviewed local reference, reconcile them first.
2. Refuse unrelated drafts and concurrent changes. Save full before-images and the reviewed update timestamp in private operator storage. Do not publish an existing unrelated draft merely because its slug matches a proposed article. Preserve existing non-English localizations, metadata and relations.
3. Upload the three manifest images once, preserving alt text and captions. Save returned media IDs in a private resumable checkpoint; do not re-upload on every retry. Verify the media objects and dimensions. Keep source/credit metadata where applicable. No downloaded HTML runtime is uploaded.
4. Build payloads with the resolved IDs. The manifest order puts Knowledge first, then Journal so the announcement's internal links have destinations. For new articles, review author attribution and section, leave optional author-profile, topic and category relations unset unless an existing appropriate production relation is explicitly chosen. The copy uses the brand editorial voice, not an invented personal byline.
5. Stage the narrow changes, read them back and compare normalised body/metadata. Use only existing `content.rich-text` and `content.image-block` components. Check published counterparts remain unchanged while staging. Inspect the preview with actual article rendering, especially long captions and image scaling.
6. Publish the reviewed English records, then read back **published** versions and verify public routes, article body images, alt/captions, sections and cross-links. Confirm cache revalidation using the existing content publication path. Record the actual published URLs and timestamp privately. Do not describe staging or successful local reads as production publication.

If the approved production connection is unavailable, leave production untouched and retain this bundle. Do not start a replacement transport, expand token permissions, restart services or publish to local as a substitute. A later publication pass should begin with fresh production reads.

## After the theme release

Only after owned release acceptance, replace the Journal's preview/closing paragraphs with availability copy, capture the real deployed header and settings controls, and update the appearance guide with tested instructions. Replace development captures with deployed captures, or keep them explicitly labelled as development history. Keep the accessibility target qualified until there is a scoped assessment; never change it to an unsupported certification claim. Translate the final instructions through the existing editorial localization workflow.
