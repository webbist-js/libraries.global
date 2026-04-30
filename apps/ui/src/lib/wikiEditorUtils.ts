// apps/ui/src/lib/wikiEditorUtils.ts
// Types and helpers for the wiki editor draft data format.
// draftData is stored as JSON in the content-moderation submission.

// ── Strapi Blocks AST node (minimal subset) ────────────────────────────────

export type StrapiBlockNode =
  | { type: "paragraph"; children: { type: "text"; text: string }[] }
  | {
      type: "heading"
      level: 1 | 2 | 3 | 4 | 5 | 6
      children: { type: "text"; text: string }[]
    }
  | {
      type: "list"
      format: "ordered" | "unordered"
      children: {
        type: "list-item"
        children: { type: "text"; text: string }[]
      }[]
    }
  | { type: "quote"; children: { type: "text"; text: string }[] }
  | { type: "code"; children: { type: "text"; text: string }[] }
  | {
      type: "image"
      image: { url: string; alternativeText?: string }
      children: { type: "text"; text: string }[]
    }

// ── Draft block types ──────────────────────────────────────────────────────

export type WikiRichTextDraftBlock = {
  __component: "content.rich-text"
  /** Plain-text representation for editing; reconstructed to Strapi blocks on save */
  text: string
  /** Original Strapi blocks AST — preserved if block was not edited */
  _originalBlocks?: StrapiBlockNode[]
  /** Whether the user has modified this block */
  _dirty?: boolean
}

export type WikiImageDraftBlock = {
  __component: "content.image-block"
  /** Strapi media ID after upload */
  imageId?: number
  /** Preview URL (either existing Strapi URL or local object URL) */
  previewUrl?: string
  caption?: string
  fullWidth?: boolean
}

export type WikiCodeDraftBlock = {
  __component: "content.code-block"
  code: string
  language?: string
  filename?: string
}

export type WikiQuoteDraftBlock = {
  __component: "content.quote-block"
  quote: string
  attribution?: string
  source?: string
}

export type WikiCalloutDraftBlock = {
  __component: "content.callout"
  type: "info" | "warning" | "tip" | "note"
  title?: string
  body: string
}

export type WikiDraftBlock =
  | WikiRichTextDraftBlock
  | WikiImageDraftBlock
  | WikiCodeDraftBlock
  | WikiQuoteDraftBlock
  | WikiCalloutDraftBlock

export type WikiDraftData = {
  targetSlug: string
  locale: string
  title?: string
  body: WikiDraftBlock[]
  editSummary?: string
  isTranslation?: boolean
}

// ── Conversion helpers ─────────────────────────────────────────────────────

/**
 * Extracts plain text from a Strapi Blocks AST array for display in a textarea.
 */
export function extractTextFromBlocks(blocks: StrapiBlockNode[]): string {
  return blocks
    .map((node) => {
      if (!("children" in node)) return ""

      return node.children
        .map((child) => ("text" in child ? child.text : ""))
        .join("")
    })
    .join("\n\n")
}

/**
 * Converts plain text back to a minimal Strapi Blocks AST (paragraph per double-newline).
 */
export function textToStrapiBlocks(text: string): StrapiBlockNode[] {
  const paragraphs = text.split(/\n\n+/).filter(Boolean)
  if (paragraphs.length === 0) {
    return [{ type: "paragraph", children: [{ type: "text", text: "" }] }]
  }

  return paragraphs.map((p) => ({
    type: "paragraph" as const,
    children: [{ type: "text" as const, text: p }],
  }))
}

/**
 * Converts a Strapi wiki article body (dynamic zone array) to the WikiDraftBlock[] format.
 */
export function articleBodyToWikiDraft(
  body: Record<string, unknown>[]
): WikiDraftBlock[] {
  return body.map((block): WikiDraftBlock => {
    const component = block.__component as string

    if (component === "content.rich-text") {
      const blocks = (block.body ?? []) as StrapiBlockNode[]

      return {
        __component: "content.rich-text",
        text: extractTextFromBlocks(blocks),
        _originalBlocks: blocks,
        _dirty: false,
      }
    }

    if (component === "content.image-block") {
      const image = block.image as Record<string, unknown> | undefined

      return {
        __component: "content.image-block",
        imageId: image?.id as number | undefined,
        previewUrl: image?.url as string | undefined,
        caption: block.caption as string | undefined,
        fullWidth: block.fullWidth as boolean | undefined,
      }
    }

    if (component === "content.code-block") {
      return {
        __component: "content.code-block",
        code: (block.code as string) ?? "",
        language: block.language as string | undefined,
        filename: block.filename as string | undefined,
      }
    }

    if (component === "content.quote-block") {
      return {
        __component: "content.quote-block",
        quote: (block.quote as string) ?? "",
        attribution: block.attribution as string | undefined,
        source: block.source as string | undefined,
      }
    }

    if (component === "content.callout") {
      return {
        __component: "content.callout",
        type: (block.type as "info" | "warning" | "tip" | "note") ?? "info",
        title: block.title as string | undefined,
        body: (block.body as string) ?? "",
      }
    }

    // Fallback: treat unknown components as empty rich-text
    return { __component: "content.rich-text", text: "", _dirty: false }
  })
}

/**
 * Converts WikiDraftBlock[] back to the Strapi dynamic zone format for submission draftData.
 */
export function wikiDraftToApiPayload(
  blocks: WikiDraftBlock[]
): Record<string, unknown>[] {
  return blocks.map((block): Record<string, unknown> => {
    if (block.__component === "content.rich-text") {
      const strapiBlocks =
        block._dirty || !block._originalBlocks
          ? textToStrapiBlocks(block.text)
          : block._originalBlocks

      return { __component: "content.rich-text", body: strapiBlocks }
    }

    if (block.__component === "content.image-block") {
      return {
        __component: "content.image-block",
        image: block.imageId ?? null,
        caption: block.caption ?? null,
        fullWidth: block.fullWidth ?? false,
      }
    }

    if (block.__component === "content.code-block") {
      return {
        __component: "content.code-block",
        code: block.code,
        language: block.language ?? null,
        filename: block.filename ?? null,
      }
    }

    if (block.__component === "content.quote-block") {
      return {
        __component: "content.quote-block",
        quote: block.quote,
        attribution: block.attribution ?? null,
        source: block.source ?? null,
      }
    }

    if (block.__component === "content.callout") {
      return {
        __component: "content.callout",
        type: block.type,
        title: block.title ?? null,
        body: block.body,
      }
    }

    return {}
  })
}
