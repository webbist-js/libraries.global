import type { Capability } from "@repo/access"

import { editorApplyHref, isArticleEditor } from "@/lib/editor-gate"

import type { ArticleKind } from "./article-editor/article.types"
import type { ActionId } from "./wizard.logic"

/** The chooser's two groups: quick record edits, and longer written pieces. */
export type ActionGroup = "index" | "write"

export const ACTION_GROUPS: readonly {
  id: ActionGroup
  icon: string
  title: string
  subtitle: string
}[] = [
  {
    id: "index",
    icon: "mdi:bank-outline",
    title: "Improve the index",
    subtitle: "Library records · quick edits",
  },
  {
    id: "write",
    icon: "mdi:pencil-outline",
    title: "Write for the community",
    subtitle: "Longer pieces",
  },
]

export type ActionMeta = {
  id: ActionId
  group: ActionGroup
  icon: string
  tintBg: string
  tintFg: string
  title: string
  description: string
  minutes: number
  /** Extra line after the time, e.g. that it leaves the hub. */
  note?: string
  /** One line of advice under the wizard's step rail. */
  tip: string
  /** Set for actions that open a full editor instead of the wizard. */
  handoff?: { href: string; blurb: string; cta: string; heading?: string }
  /**
   * The handoff opens the Knowledge editor, which needs this kind's editor
   * role. Everyone else is sent to the role application with this copy.
   */
  editorsOnly?: {
    kind: ArticleKind
    note: string
    heading: string
    blurb: string
    cta: string
  }
}

export const ACTIONS: readonly ActionMeta[] = [
  {
    id: "add",
    group: "index",
    tip: "Search first: improving a record that’s already there beats adding a duplicate.",
    icon: "mdi:plus",
    tintBg: "var(--t-palette-amber-bg)",
    tintFg: "var(--t-palette-amber-fg)",
    title: "Add a missing library",
    description:
      "A library that isn’t in the index yet, anywhere in the world.",
    minutes: 5,
    note: "Opens the full form",
    handoff: {
      href: "/contribute/index/new",
      blurb:
        "A new record starts in the guided form: name and place, opening hours, then your sources. It saves as you go.",
      cta: "Open the full form",
    },
  },
  {
    id: "correction",
    group: "index",
    tip: "Multiple changes per suggestion makes it quicker to review.",
    icon: "mdi:pencil-outline",
    tintBg: "var(--t-accent-chip)",
    tintFg: "var(--t-accent-primary)",
    title: "Suggest a correction",
    description:
      "Opening hours, address, accessibility or anything out of date.",
    minutes: 2,
  },
  {
    id: "photo",
    group: "index",
    tip: "Only share photos you took, or that already carry an open licence.",
    icon: "mdi:camera-outline",
    tintBg: "var(--tint-public-bg)",
    tintFg: "var(--tint-public-fg)",
    title: "Share a photo",
    description:
      "A photo you took or have permission to share under an open licence.",
    minutes: 3,
  },
  {
    id: "source",
    group: "index",
    tip: "A link to the library’s own page is the strongest source.",
    icon: "mdi:link-variant",
    tintBg: "var(--tint-national-bg)",
    tintFg: "var(--tint-national-fg)",
    title: "Add a source",
    description: "A reference that backs up details already in a record.",
    minutes: 2,
  },
  {
    id: "journal",
    group: "write",
    tip: "Editors may suggest changes before a piece is published. You’re credited either way.",
    icon: "mdi:newspaper-variant-outline",
    tintBg: "var(--tint-special-bg)",
    tintFg: "var(--tint-special-fg)",
    title: "Write for the journal",
    description:
      "A story, profile or essay about a library, its collections or its people.",
    minutes: 20,
    note: "Opens the article editor",
    handoff: {
      href: "/contribute/knowledge/new?type=journal",
      blurb:
        "Journal pieces are written in the article editor: a title, a short summary, then the body. Drafts save to your account, and an editor reviews it before it’s published.",
      cta: "Start a journal article",
    },
    editorsOnly: {
      kind: "journal",
      note: "Opens the editor application",
      heading: "Apply to write for the journal",
      blurb:
        "Journal pieces are written by Journal editors. Apply to become one: say what you’d like to write about, and a moderator reads every application.",
      cta: "Apply to be a Journal editor",
    },
  },
  {
    id: "knowledge",
    group: "write",
    tip: "Translations are welcome: pick a page, then choose the language you’re writing in.",
    icon: "mdi:book-open-page-variant-outline",
    tintBg: "var(--tint-academic-bg)",
    tintFg: "var(--tint-academic-fg)",
    title: "Improve the knowledge base",
    description: "Edit a Knowledge page, write a new guide or translate one.",
    minutes: 10,
    note: "Opens the Knowledge editor",
    handoff: {
      href: "/contribute/knowledge",
      blurb:
        "Pick a Knowledge page to improve or translate, or start a new guide. Changes go to review before they appear on the site.",
      cta: "Open the Knowledge editor",
    },
    editorsOnly: {
      kind: "knowledge",
      note: "Opens the editor application",
      heading: "Apply to edit the knowledge base",
      blurb:
        "Knowledge pages are written and translated by Knowledge editors. Spotted a mistake? Use “Report an issue” on the page itself. To write and edit pages yourself, apply to become an editor.",
      cta: "Apply to be a Knowledge editor",
    },
  },
]

export function actionMeta(id: ActionId): ActionMeta {
  return ACTIONS.find((a) => a.id === id)!
}

/**
 * `actionMeta` for this viewer: an editors-only handoff sends anyone
 * without that editor role to the role application instead. UI only; the
 * editor pages redirect too.
 */
export function actionFor(
  id: ActionId,
  has: (cap: Capability) => boolean
): ActionMeta {
  const meta = actionMeta(id)
  const gate = meta.editorsOnly
  if (!gate || !meta.handoff || isArticleEditor(has, gate.kind)) return meta

  return {
    ...meta,
    note: gate.note,
    handoff: {
      href: editorApplyHref(gate.kind),
      heading: gate.heading,
      blurb: gate.blurb,
      cta: gate.cta,
    },
  }
}
