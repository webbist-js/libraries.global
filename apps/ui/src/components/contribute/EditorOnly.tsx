"use client"

import type { ReactNode } from "react"

import type { ArticleKind } from "@/components/contribute/article-editor/article.types"
import { useCapabilities } from "@/lib/access-client"
import { isArticleEditor } from "@/lib/editor-gate"

/**
 * Renders `children` (a link into the Knowledge editor) only for an editor
 * of `kind` (or, with no kind, of either), and `fallback` for everyone else,
 * including while the session loads. UI only: the editor pages redirect
 * non-editors to the role application.
 */
export function EditorOnly({
  kind,
  children,
  fallback = null,
}: {
  readonly kind?: ArticleKind
  readonly children: ReactNode
  readonly fallback?: ReactNode
}) {
  const { has, ready } = useCapabilities()

  return ready && isArticleEditor(has, kind) ? children : fallback
}
