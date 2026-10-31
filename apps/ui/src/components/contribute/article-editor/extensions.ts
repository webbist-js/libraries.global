import { mergeAttributes, Node } from "@tiptap/core"
import Blockquote from "@tiptap/extension-blockquote"
import CodeBlock from "@tiptap/extension-code-block"
import Image from "@tiptap/extension-image"
import { Placeholder } from "@tiptap/extensions"
import StarterKit from "@tiptap/starter-kit"

import { type CALLOUT_KINDS, HEADING_LEVELS } from "./articleBlocks"

type CalloutKind = (typeof CALLOUT_KINDS)[number]

/**
 * The site's `content.callout` component as an editor node: a boxed aside
 * with a kind (info, warning, tip, note) and an optional title. Its body is
 * ordinary paragraphs.
 */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "paragraph+",
  defining: true,
  addAttributes() {
    return {
      kind: {
        default: "note",
        parseHTML: (el) => el.dataset.kind ?? "note",
        renderHTML: (attrs) => ({ "data-kind": attrs.kind }),
      },
      title: {
        default: null,
        parseHTML: (el) => el.dataset.title,
        renderHTML: (attrs) =>
          attrs.title ? { "data-title": attrs.title } : {},
      },
    }
  },
  parseHTML() {
    return [{ tag: "aside[data-callout]" }, { tag: "div[data-callout]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-callout": "",
        class: "ae-callout",
        role: "note",
      }),
      0,
    ]
  },
  addCommands() {
    return {
      toggleCallout:
        (attrs?: { kind?: CalloutKind; title?: string | null }) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs),
      setCalloutKind:
        (kind: CalloutKind) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { kind }),
    }
  },
})

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      toggleCallout: (attrs?: {
        kind?: CalloutKind
        title?: string | null
      }) => ReturnType
      setCalloutKind: (kind: CalloutKind) => ReturnType
    }
  }
}

/** Quotes keep the site's attribution and source. */
export const ArticleBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      attribution: { default: null },
      source: { default: null },
    }
  },
})

/** Code blocks keep the site's language and filename. */
export const ArticleCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      filename: { default: null },
    }
  },
})

/** Images uploaded through the editor carry their Strapi media id and a caption. */
export const ArticleImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      imageId: { default: null },
      caption: { default: null },
      fullWidth: { default: false },
    }
  },
})

/** The editor's extension set. */
export function articleExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto"],
      },
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    ArticleBlockquote,
    ArticleCodeBlock,
    ArticleImage.configure({ inline: false, allowBase64: false }),
    Callout,
    Placeholder.configure({ placeholder }),
  ]
}
