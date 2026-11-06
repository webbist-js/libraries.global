/** Remove Strapi component/row ids so CMS reads can be compared and resent. */
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
