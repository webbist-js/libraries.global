const ALLOWED_COMPONENTS = new Set([
  "content.rich-text",
  "content.image-block",
  "content.code-block",
  "content.quote-block",
  "content.callout",
])

function clampBlocks(nodes: unknown): unknown {
  if (!Array.isArray(nodes)) return nodes

  return nodes.map((n) => {
    if (!n || typeof n !== "object") return n
    const node = { ...(n as Record<string, unknown>) }
    if (node.type === "heading") {
      const lvl = Number(node.level)
      node.level = Number.isInteger(lvl) ? Math.min(6, Math.max(1, lvl)) : 2
    }
    if ("children" in node) node.children = clampBlocks(node.children)

    return node
  })
}

/** Allowlist dynamic-zone components, drop client-supplied ids, clamp heading levels to 1–6. */
export function sanitizeWikiBody(body: unknown): unknown[] | null {
  if (!Array.isArray(body)) return null

  return body
    .filter(
      (c): c is Record<string, unknown> =>
        !!c &&
        typeof c === "object" &&
        ALLOWED_COMPONENTS.has(String((c as any).__component))
    )
    .map(({ id: _id, ...rest }) => {
      if (rest.__component === "content.rich-text")
        rest.body = clampBlocks(rest.body)

      return rest
    })
}
