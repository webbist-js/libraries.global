import type { Capability } from "@repo/access"
import { redirect } from "next/navigation"

import {
  ARTICLE_KIND_META,
  type ArticleKind,
} from "@/components/contribute/article-editor/article.types"

import { hasCapability } from "./access-server"

/**
 * The Knowledge editor (/contribute/knowledge/*) is for editors only:
 * Knowledge articles need `docs.directEdit` (wiki_editor, editorial_board),
 * Journal articles `journal.directEdit` (journal_editor, editorial_board).
 * Everyone else is sent to the role application. Contributor Roles only:
 * no plan or tier opens it. A route pre-check: Strapi's submission-policy
 * still decides every write.
 */
export const EDITOR_APPLY_HREF = "/contribute/knowledge/apply"

const APPLY_ROLE: Record<ArticleKind, "wiki_editor" | "journal_editor"> = {
  knowledge: "wiki_editor",
  journal: "journal_editor",
}

/** The role application, preset to the editor role for `kind`. */
export function editorApplyHref(kind?: ArticleKind): string {
  return kind
    ? `${EDITOR_APPLY_HREF}?role=${APPLY_ROLE[kind]}`
    : EDITOR_APPLY_HREF
}

type Has = (cap: Capability) => boolean

/** Whether `has` grants editing `kind` articles, or (no kind) either kind. */
export function isArticleEditor(has: Has, kind?: ArticleKind): boolean {
  return kind
    ? has(ARTICLE_KIND_META[kind].capability)
    : has("docs.directEdit") || has("journal.directEdit")
}

/** The article kinds `has` may edit, Knowledge first. */
export function editableKinds(has: Has): ArticleKind[] {
  return (["knowledge", "journal"] as const).filter((k) =>
    isArticleEditor(has, k)
  )
}

/** Session-user form of `isArticleEditor`, for server pages. */
export function userIsArticleEditor(
  user: { capabilities?: unknown } | null | undefined,
  kind?: ArticleKind
): boolean {
  return isArticleEditor((cap) => hasCapability(user, cap), kind)
}

/**
 * Editor pages: send a signed-in user without the editor role for `kind`
 * (or, with no kind, either role) to the role application. Check sign-in
 * first; this assumes a session user.
 */
export function requireEditorOrApply(
  user: { capabilities?: unknown },
  kind?: ArticleKind
): void {
  if (!userIsArticleEditor(user, kind)) redirect(editorApplyHref(kind))
}
