/**
 * Renders schema.org structured data as <script type="application/ld+json">.
 * Server component. Values may originate from third-party feeds or CMS
 * editors, so the JSON is escaped to prevent `</script>` break-outs.
 */

type JsonLdData = Record<string, unknown> | Record<string, unknown>[]

/** JSON.stringify that is safe to inline inside a <script> element. */
export function serializeJsonLd(data: JsonLdData): string {
  return JSON.stringify(data)
    .replaceAll("<", String.raw`\u003c`)
    .replaceAll(">", String.raw`\u003e`)
    .replaceAll("&", String.raw`\u0026`)
}

export function JsonLd({ data }: { data: JsonLdData | null | undefined }) {
  if (!data) return null

  return (
    <script
      type="application/ld+json"
      // Escaped by serializeJsonLd — no raw `<` can reach the DOM.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
