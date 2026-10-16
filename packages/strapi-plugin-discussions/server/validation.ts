export class DiscussionError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "DiscussionError"
  }
}
export const fail = (status: number, message: string): never => {
  throw new DiscussionError(status, message)
}
export function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail(400, "An object body is required")

  return value as Record<string, any>
}
export function text(
  value: unknown,
  field: string,
  max: number,
  optional = false
): string {
  if (
    optional &&
    (value === undefined ||
      value === null ||
      (typeof value === "string" && value.length <= max && !value.trim()))
  )
    return ""
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    [...value].some(
      (char) =>
        (char.codePointAt(0) ?? 0) < 32 &&
        ![9, 10, 13].includes(char.codePointAt(0) ?? 0)
    )
  )
    return fail(400, `Invalid ${field}`)

  return value.trim()
}
export function id(value: unknown): string {
  return text(value, "id", 128)
}
export function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    return fail(400, "A non-negative integer baseVersion is required")

  return Number(value)
}
export function page(query: any, max: number) {
  const limit =
    query?.limit === undefined ? Math.min(20, max) : Number(query.limit)
  const offset = query?.offset === undefined ? 0 : Number(query.offset)
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > max ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 100000
  )
    return fail(400, "Invalid pagination")

  return { limit, offset }
}
export function safeUrl(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    [...value].some(
      (char) =>
        (char.codePointAt(0) ?? 0) <= 32 ||
        (char.codePointAt(0) ?? 0) === 127 ||
        char === String.fromCodePoint(92)
    )
  )
    return fail(400, "Invalid URL")
  if (value.startsWith("/") && !value.startsWith("//")) return value
  try {
    const parsed = new URL(value)
    if (
      ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
    )
      return value
  } catch {
    // Invalid URLs fall through to the same bounded validation error.
  }

  return fail(400, "Only relative or HTTP(S) URLs are supported")
}
export function language(value: unknown): string {
  const locale = text(value, "language", 64)
  try {
    return Intl.getCanonicalLocales(locale)[0]
  } catch {
    return fail(400, "Invalid language")
  }
}
