import { Box, Flex, Typography } from "@strapi/design-system"
import { diffWords } from "diff"

type Submission = {
  id: number
  draftData?: Record<string, unknown> | null
  [key: string]: unknown
}

function extractText(body: unknown): string {
  if (!Array.isArray(body)) return ""
  const parts: string[] = []
  for (const block of body) {
    if (!block || typeof block !== "object") continue
    const b = block as Record<string, unknown>
    const comp = b.__component as string | undefined
    switch (comp) {
      case "content.rich-text": {
        const text = b.text
        if (typeof text === "string") parts.push(text)

        break
      }
      case "content.quote-block": {
        const q = b.quote
        if (typeof q === "string") parts.push(`"${q}"`)

        break
      }
      case "content.callout": {
        const body2 = b.body
        if (typeof body2 === "string") parts.push(body2)

        break
      }
      case "content.code-block": {
        const code = b.code
        if (typeof code === "string")
          parts.push(`[code: ${code.substring(0, 80)}...]`)

        break
      }
      // No default
    }
  }

  return parts.join("\n\n")
}

export function WikiEditDiffPanel({ sub }: { sub: Submission }) {
  const draft = sub.draftData ?? {}
  const targetSlug =
    typeof draft.targetSlug === "string" ? draft.targetSlug : "—"
  const locale = typeof draft.locale === "string" ? draft.locale : "en"
  const title = typeof draft.title === "string" ? draft.title : null
  const editSummary =
    typeof draft.editSummary === "string" ? draft.editSummary : null
  const bodyText = extractText(draft.body)

  // Use diffWords to render additions-only view (diff against empty = everything is added)
  const diff = diffWords("", bodyText)

  return (
    <Box>
      {/* Header */}
      <Flex gap={2} style={{ marginBottom: "12px" }}>
        <Typography variant="sigma" style={{ color: "#666" }}>
          WIKI EDIT
        </Typography>
        <Typography variant="sigma" style={{ color: "#999" }}>
          ·
        </Typography>
        <Typography variant="sigma" style={{ color: "#666" }}>
          {targetSlug}
        </Typography>
        <Typography variant="sigma" style={{ color: "#999" }}>
          [{locale.toUpperCase()}]
        </Typography>
      </Flex>

      {/* Edit summary */}
      {editSummary && (
        <Box
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            background: "#f0f7ff",
            border: "1px solid #b3d4f0",
            borderRadius: "6px",
          }}
        >
          <Typography
            variant="sigma"
            style={{
              color: "#1e40af",
              fontSize: "11px",
              display: "block",
              marginBottom: "4px",
            }}
          >
            EDIT SUMMARY
          </Typography>
          <Typography variant="omega" style={{ color: "#1e3a5f" }}>
            {editSummary}
          </Typography>
        </Box>
      )}

      {/* Proposed title */}
      {title && (
        <Box style={{ marginBottom: "16px" }}>
          <Typography
            variant="sigma"
            style={{
              color: "#666",
              fontSize: "11px",
              display: "block",
              marginBottom: "4px",
            }}
          >
            PROPOSED TITLE
          </Typography>
          <Typography variant="beta" style={{ color: "#111" }}>
            {title}
          </Typography>
        </Box>
      )}

      {/* Body content */}
      {bodyText && (
        <Box>
          <Typography
            variant="sigma"
            style={{
              color: "#666",
              fontSize: "11px",
              display: "block",
              marginBottom: "8px",
            }}
          >
            PROPOSED BODY
          </Typography>
          <Box
            style={{
              padding: "12px 16px",
              background: "#f8f8f8",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              maxHeight: "320px",
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: "12px",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {diff.map((part, i) => (
              <span
                key={i}
                style={{
                  background: part.added ? "#d1fae5" : "transparent",
                  color: part.added ? "#065f46" : "#374151",
                }}
              >
                {part.value}
              </span>
            ))}
          </Box>
          <Typography
            variant="pi"
            style={{ color: "#9ca3af", marginTop: "6px", display: "block" }}
          >
            Compare against the live article at /wiki/{targetSlug} to review
            changes.
          </Typography>
        </Box>
      )}

      {!bodyText && !title && !editSummary && (
        <Typography variant="omega" style={{ color: "#9ca3af" }}>
          No draft content available.
        </Typography>
      )}
    </Box>
  )
}
