/** Privacy boundary shared by error events and performance transactions. */
const PRIVATE_KEY =
  /password|secret|token|credential|authorization|cookie|apikey|querystring|dbstatement|dbquery|requestbody|responsebody|payload|confirmationcode|oauthcode|ipaddress|email|latitude|longitude|position/
const SAFE_HEADERS = new Set(["user-agent", "content-type", "host"])
const FILTERED = "[Filtered]"

function cleanUrl(value: string): string {
  const path = value.split(/[?#]/, 1)[0] ?? ""

  return path
    .replaceAll(/(\/staff\/teams?\/join\/)[^/]+/gi, `$1${FILTERED}`)
    .replaceAll(
      /(\/(?:reset-password|magic-link|verify-email)\/)[^/]+/gi,
      `$1${FILTERED}`
    )
    .replaceAll(/(https?:\/\/)[^/@\s]+@/gi, "$1")
}

function cleanText(value: string, key: string): string {
  const text =
    /^(?:url|uri|href|referer|referrer|from|to|target)$|[._](?:url|uri)$/i.test(
      key
    )
      ? cleanUrl(value)
      : value.replaceAll(/https?:\/\/[^\s<>"']+|\/[^\s<>"']+/g, cleanUrl)

  return text
    .replaceAll(
      /\/(?:staff\/teams?\/join|reset-password|magic-link|verify-email)\/[^\s?#<>"']+/gi,
      cleanUrl
    )
    .replaceAll(/\bBearer\s+[^\s,;"']+/gi, `Bearer ${FILTERED}`)
    .replaceAll(
      /\b(password|secret|token|api[_-]?key|code)\s*[:=]\s*[^\s,;&"']+/gi,
      `$1=${FILTERED}`
    )
}

/** Mutates the SDK envelope in place; never serialises a second raw copy. */
export function scrubTelemetryEvent<T extends object>(event: T): T {
  const seen = new WeakSet<object>()
  function visit(value: unknown, key = "", depth = 0): unknown {
    if (typeof value === "string") return cleanText(value, key)
    if (value === null || typeof value !== "object") return value
    if (depth > 12 || seen.has(value)) return FILTERED
    seen.add(value)
    if (Array.isArray(value)) return visitArray(value, key, depth)

    return visitRecord(value as Record<string, unknown>, key, depth)
  }
  function visitArray(value: unknown[], key: string, depth: number) {
    if (key === "breadcrumbs") {
      const safe = value.filter(
        (item) =>
          !item ||
          typeof item !== "object" ||
          !("category" in item) ||
          item.category !== "console"
      )
      value.splice(0, value.length, ...safe)
    }
    for (let i = 0; i < value.length; i++)
      value[i] = visit(value[i], key, depth + 1)

    return value
  }
  function visitHeaders(source: unknown, depth: number) {
    const headers: Record<string, unknown> = {}
    if (!source || typeof source !== "object") return headers
    for (const [header, content] of Object.entries(source)) {
      if (SAFE_HEADERS.has(header.toLowerCase()))
        headers[header.toLowerCase()] = visit(content, header, depth + 1)
    }

    return headers
  }
  function visitRecord(
    record: Record<string, unknown>,
    key: string,
    depth: number
  ) {
    if (key === "user") return record.id === undefined ? {} : { id: record.id }
    for (const name of Object.keys(record)) {
      // Sentry removes this field before serialization. Its live scopes and
      // request objects belong to the SDK and must never be traversed or changed.
      if (depth === 0 && name === "sdkProcessingMetadata") continue
      const normalized = name.replaceAll(/[^a-z]/gi, "").toLowerCase()
      const requestBody =
        key === "request" && (normalized === "data" || normalized === "body")
      if (
        PRIVATE_KEY.test(normalized) ||
        normalized === "arguments" ||
        requestBody
      )
        delete record[name]
      else if (normalized === "headers")
        record[name] = visitHeaders(record[name], depth)
      else record[name] = visit(record[name], name, depth + 1)
    }

    return record
  }
  visit(event)

  return event
}
