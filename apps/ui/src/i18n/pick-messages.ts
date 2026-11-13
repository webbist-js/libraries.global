type Messages = Record<string, unknown>

const isTree = (value: unknown): value is Messages =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Copy the given scope units (`"ui"`, `"staticUi.atlas"`) out of a catalogue.
 * Units missing from the catalogue are skipped.
 */
export function pickMessages(
  messages: Messages,
  units: readonly string[]
): Messages {
  const picked: Messages = {}
  for (const unit of units) {
    const parts = unit.split(".")
    let source: unknown = messages
    for (const part of parts) source = isTree(source) ? source[part] : undefined
    if (source === undefined) continue
    let target = picked
    for (const part of parts.slice(0, -1)) {
      const next = target[part]
      const child = isTree(next) ? next : {}
      target[part] = child
      target = child
    }
    target[parts.at(-1)!] = source
  }

  return picked
}

/** Add a scope's messages to those already in context. */
export function mergeMessages(base: Messages, extra: Messages): Messages {
  const merged: Messages = { ...base }
  for (const [key, value] of Object.entries(extra)) {
    const existing = merged[key]
    merged[key] =
      isTree(existing) && isTree(value) ? mergeMessages(existing, value) : value
  }

  return merged
}
