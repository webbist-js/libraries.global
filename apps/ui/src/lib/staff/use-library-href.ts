"use client"

import { useStaff } from "@/lib/access-client"
import { staffLibraryHref } from "@/lib/staff/paths"

/**
 * This library's staff page links, for client components that hold its
 * document id. The slug comes from the session's staff memberships (or
 * `slug`, when the caller already has it); until the session is known the
 * links fall back to the staff index.
 */
export function useStaffLibraryHref(documentId: string, slug?: string | null) {
  const { libraries } = useStaff()
  const resolved =
    slug ?? libraries.find((library) => library.id === documentId)?.slug

  return (suffix = "") => staffLibraryHref(resolved, suffix)
}
