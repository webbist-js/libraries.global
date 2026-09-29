import { describe, expect, it } from "vitest"

import {
  dynamicZoneToTiptap,
  isEmptyDoc,
  tiptapToDynamicZone,
  wordCount,
} from "./articleBlocks"

const body = [
  {
    __component: "content.rich-text",
    id: 1,
    body: [
      {
        type: "heading",
        level: 2,
        children: [{ type: "text", text: "Hours" }],
      },
      {
        type: "paragraph",
        children: [
          { type: "text", text: "See " },
          {
            type: "link",
            url: "https://example.org",
            children: [{ type: "text", text: "the site", bold: true }],
          },
          { type: "text", text: "." },
        ],
      },
      {
        type: "list",
        format: "ordered",
        children: [
          { type: "list-item", children: [{ type: "text", text: "One" }] },
          { type: "list-item", children: [{ type: "text", text: "Two" }] },
        ],
      },
    ],
  },
  {
    __component: "content.image-block",
    id: 2,
    image: { id: 77, url: "/uploads/a.jpg", alternativeText: "A" },
    caption: "Reading room",
    fullWidth: true,
  },
  {
    __component: "content.code-block",
    id: 3,
    code: "npm i",
    language: "bash",
    filename: null,
  },
  {
    __component: "content.quote-block",
    id: 4,
    quote: "Books are\n\nlight.",
    attribution: "Someone",
    source: null,
  },
  {
    __component: "content.callout",
    id: 5,
    type: "tip",
    title: "Tip",
    body: "Ask staff.",
  },
]

describe("dynamicZoneToTiptap", () => {
  it("builds one flat document with marks, links, lists and rich components", () => {
    const doc = dynamicZoneToTiptap(body, (u) => `https://cdn${u}`)
    expect(doc.content.map((n) => n.type)).toEqual([
      "heading",
      "paragraph",
      "orderedList",
      "image",
      "codeBlock",
      "blockquote",
      "callout",
    ])
    expect(doc.content[1]!.content![1]).toEqual({
      type: "text",
      text: "the site",
      marks: [
        { type: "bold" },
        { type: "link", attrs: { href: "https://example.org" } },
      ],
    })
    expect(doc.content[3]!.attrs).toEqual({
      src: "https://cdn/uploads/a.jpg",
      alt: "A",
      imageId: 77,
      caption: "Reading room",
      fullWidth: true,
    })
    expect(doc.content[5]!.content).toHaveLength(2)
    expect(doc.content[6]!.attrs).toEqual({ kind: "tip", title: "Tip" })
  })

  it("gives an empty body one empty paragraph", () => {
    expect(dynamicZoneToTiptap(null)).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    })
  })
})

describe("tiptapToDynamicZone", () => {
  it("round-trips the sample body, minus ids and with the image by id", () => {
    const out = tiptapToDynamicZone(dynamicZoneToTiptap(body))
    expect(out.map((b) => b.__component)).toEqual([
      "content.rich-text",
      "content.image-block",
      "content.code-block",
      "content.quote-block",
      "content.callout",
    ])
    const rich = out[0]!.body as any[]
    expect(rich[0]).toEqual({
      type: "heading",
      level: 2,
      children: [{ type: "text", text: "Hours" }],
    })
    expect(rich[1].children).toEqual([
      { type: "text", text: "See " },
      {
        type: "link",
        url: "https://example.org",
        children: [{ type: "text", text: "the site", bold: true }],
      },
      { type: "text", text: "." },
    ])
    expect(rich[2]).toEqual({
      type: "list",
      format: "ordered",
      children: [
        { type: "list-item", children: [{ type: "text", text: "One" }] },
        { type: "list-item", children: [{ type: "text", text: "Two" }] },
      ],
    })
    expect(out[1]).toEqual({
      __component: "content.image-block",
      image: 77,
      caption: "Reading room",
      fullWidth: true,
    })
    expect(out[2]).toMatchObject({ code: "npm i", language: "bash" })
    expect(out[3]).toEqual({
      __component: "content.quote-block",
      quote: "Books are\n\nlight.",
      attribution: "Someone",
      source: null,
    })
    expect(out[4]).toEqual({
      __component: "content.callout",
      type: "tip",
      title: "Tip",
      body: "Ask staff.",
    })
  })

  it("keeps a plain blockquote and a pasted image inside the rich text", () => {
    const out = tiptapToDynamicZone({
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Q" }] },
          ],
        },
        { type: "image", attrs: { src: "https://x/y.png", alt: "y" } },
        { type: "paragraph" },
      ],
    })
    expect(out).toHaveLength(1)
    const rich = out[0]!.body as any[]
    expect(rich[0]).toEqual({
      type: "quote",
      children: [{ type: "text", text: "Q" }],
    })
    expect(rich[1]).toMatchObject({
      type: "image",
      image: { url: "https://x/y.png" },
    })
    // The trailing empty paragraph TipTap keeps for the cursor is dropped.
    expect(rich).toHaveLength(2)
  })

  it("merges adjacent text runs that share a link and clamps heading levels", () => {
    const out = tiptapToDynamicZone({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 5 },
          content: [
            {
              type: "text",
              text: "a",
              marks: [{ type: "link", attrs: { href: "https://l" } }],
            },
            {
              type: "text",
              text: "b",
              marks: [
                { type: "italic" },
                { type: "link", attrs: { href: "https://l" } },
              ],
            },
          ],
        },
      ],
    })
    expect(out[0]!.body).toEqual([
      {
        type: "heading",
        level: 3,
        children: [
          {
            type: "link",
            url: "https://l",
            children: [
              { type: "text", text: "a" },
              { type: "text", text: "b", italic: true },
            ],
          },
        ],
      },
    ])
  })
})

describe("measures", () => {
  it("counts words and detects an empty document", () => {
    const doc = dynamicZoneToTiptap(body)
    expect(wordCount(doc)).toBeGreaterThan(8)
    expect(isEmptyDoc(doc)).toBe(false)
    expect(isEmptyDoc(dynamicZoneToTiptap(null))).toBe(true)
    expect(
      isEmptyDoc({
        type: "doc",
        content: [{ type: "image", attrs: { src: "x" } }],
      })
    ).toBe(false)
  })
})
