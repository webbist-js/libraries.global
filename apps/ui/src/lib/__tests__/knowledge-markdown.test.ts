import { describe, expect, it } from "vitest"

import { renderKnowledgeMarkdown } from "@/lib/knowledge-markdown"
import type { WikiArticleDetail } from "@/lib/strapi-api/content/server"

const context = {
  canonicalUrl: "https://libraries.global/knowledge/data-api/guide",
  locale: "en",
}
const article = (body: WikiArticleDetail["body"]): WikiArticleDetail => ({
  documentId: "article",
  title: "Using the API",
  slug: "guide",
  body,
  author: "Library staff",
  updatedAt: "2026-10-26T12:00:00.000Z",
  articleStatus: "beta",
})
const text = (value: string, options = {}) => ({
  type: "text",
  text: value,
  ...options,
})

describe("Knowledge Markdown", () => {
  it("preserves formatted prose, nested lists, links, quotes and rich-text code", () => {
    const result = renderKnowledgeMarkdown(
      article([
        {
          __component: "content.rich-text",
          id: 1,
          body: [
            { type: "heading", level: 2, children: [text("Requests")] },
            {
              type: "paragraph",
              children: [
                text("Use "),
                text("a key", { bold: true }),
                text(" and "),
                {
                  type: "link",
                  url: "/knowledge/data-api/reference?example=a(b)",
                  children: [text("the reference")],
                },
                text(" or "),
                text("old keys", { strikethrough: true }),
              ],
            },
            {
              type: "list",
              format: "ordered",
              children: [
                { type: "list-item", children: [text("First request")] },
                {
                  type: "list",
                  format: "unordered",
                  children: [
                    {
                      type: "list-item",
                      children: [text("Keep source credits")],
                    },
                  ],
                },
                { type: "list-item", children: [text("Next request")] },
              ],
            },
            { type: "quote", children: [text("Published facts only")] },
            { type: "code", children: [text('const value = "```";')] },
          ],
        },
      ]),
      context
    )
    expect(result).toContain("# Using the API")
    expect(result).toContain("## Requests")
    expect(result).toContain("**a key**")
    expect(result).toContain(
      "[the reference](<https://libraries.global/knowledge/data-api/reference?example=a(b)>)"
    )
    expect(result).toContain("~~old keys~~")
    expect(result).toContain(
      "1. First request\n   - Keep source credits\n2. Next request"
    )
    expect(result).toContain("> Published facts only")
    expect(result).toContain('````\nconst value = "```";\n````')
    expect(result).toContain(
      "Source: [Libraries Global](<https://libraries.global/knowledge/data-api/guide>)"
    )
    expect(result).toContain("Updated: 2026-10-26T12:00:00.000Z")
  })

  it("keeps every body component and uses public URLs for both kinds of image", () => {
    const result = renderKnowledgeMarkdown(
      article([
        {
          __component: "content.code-block",
          id: 1,
          code: "line one\n```\nline three\n",
          language: "json",
          filename: "example.json",
        },
        {
          __component: "content.callout",
          id: 2,
          type: "warning",
          title: "Current availability",
          body: "Read the access guide.\nDo not assume checkout is enabled.",
        },
        {
          __component: "content.quote-block",
          id: 3,
          quote: "A sourced fact.",
          attribution: "An author",
          source: "A publication",
        },
        {
          __component: "content.image-block",
          id: 4,
          image: { url: "/uploads/example.png" },
          caption: "Example image",
          alternativeText: "API response",
        },
        {
          __component: "content.rich-text",
          id: 5,
          body: [
            {
              type: "image",
              image: {
                url: "/uploads/legacy.png",
                alternativeText: "Legacy image",
              },
            },
          ],
        },
      ]),
      context
    )
    expect(result).toContain("File: `example.json`")
    expect(result).toContain("````json\nline one\n```\nline three\n````")
    expect(result).toContain(
      "> **Current availability**\n>\n> Read the access guide.\n> Do not assume checkout is enabled."
    )
    expect(result).toContain("An author — A publication")
    expect(result).toContain(
      "![API response](<https://libraries.global/api/asset/uploads/example.png>)\n\nExample image"
    )
    expect(result).toContain(
      "![Legacy image](<https://libraries.global/api/asset/uploads/legacy.png>)"
    )
  })

  it("keeps link labels but excludes unsafe schemes and raw HTML", () => {
    // eslint-disable-next-line sonarjs/code-eval -- Untrusted input used to verify link sanitization.
    const unsafeUrl = "javascript:alert(1)"
    const result = renderKnowledgeMarkdown(
      article([
        {
          __component: "content.rich-text",
          id: 1,
          body: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  url: unsafeUrl,
                  children: [text("Unsafe link")],
                },
                text(" <script> [literal]"),
              ],
            },
          ],
        },
      ]),
      context
    )
    expect(result).toContain("Unsafe link")
    expect(result).not.toContain(unsafeUrl)
    expect(result).not.toContain("<script>")
    expect(result).toContain(String.raw`\[literal\]`)
  })
})
