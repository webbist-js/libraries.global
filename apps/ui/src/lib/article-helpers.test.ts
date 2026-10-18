import { describe, expect, it } from "vitest"

import { readingTimeMinutes } from "@/components/docs/docs.config"

import { countWords, estimateReadingTime } from "./article-helpers"

const words = Array.from({ length: 201 }, () => "word").join(" ")
describe("article text measurements", () => {
  it("uses the same semantic estimate for Knowledge and Journal, independently of block grouping", () => {
    const body = [
      {
        __component: "content.rich-text",
        body: [
          { type: "paragraph", children: [{ type: "text", text: words }] },
        ],
      },
    ]
    expect(countWords(body)).toBe(201)
    expect(estimateReadingTime(body)).toBe(2)
    expect(readingTimeMinutes(body)).toBe(2)
  })

  it("counts visible prose/code/captions without machine metadata", () => {
    const body = [
      {
        __component: "content.rich-text",
        body: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "A " },
              {
                type: "link",
                url: "https://example.org/many/words",
                children: [{ type: "text", text: "library" }],
              },
            ],
          },
        ],
      },
      {
        __component: "content.code-block",
        code: "pnpm dev",
        language: "some long language",
        filename: "many metadata words",
      },
      {
        __component: "content.quote-block",
        quote: "Open books",
        source: "https://example.org",
      },
      { __component: "content.callout", title: "Tip", body: "Ask staff" },
      {
        __component: "content.image-block",
        caption: "Reading room",
        image: { url: "/images/a b c.png", alternativeText: "a very long alt" },
      },
    ]
    expect(countWords(body)).toBe(11)
    expect(estimateReadingTime(body)).toBe(readingTimeMinutes(body))
  })
})
