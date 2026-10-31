/** Keep directory controls bounded and exclude unrelated query parameters. */
export function networkQuery(
  input: Record<string, string | string[] | undefined>
) {
  const query = new URLSearchParams()
  for (const key of [
    "q",
    "kind",
    "country",
    "region",
    "type",
    "facility",
    "sort",
    "page",
  ]) {
    const value = input[key]
    const text =
      key === "facility" && Array.isArray(value)
        ? value.join(",")
        : typeof value === "string"
          ? value
          : ""
    if (text) query.set(key, text.slice(0, key === "facility" ? 600 : 120))
  }

  return query
}
