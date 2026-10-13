/** A single library reference: hierarchy slugs joined by colons, or a legacy shortcode. */
export function isLibraryEntityRef(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 255 &&
    /^[A-Za-z0-9]+(?:[:_-][A-Za-z0-9]+)+$/.test(value)
  )
}
