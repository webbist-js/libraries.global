/** Strapi's PostgreSQL dialect returns raw JSONB as text for its field mapper. */
export function atlasJson<T = any>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) : value
}
