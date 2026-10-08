"use client"

import { useEffect } from "react"

import { setCurrentLibrary } from "@/lib/staff/current-library"

/**
 * Tells the staff drawer which library this page is about. Rendered by
 * `LibraryDetailPage`; clears itself when the page unmounts.
 */
export function CurrentLibraryMarker({
  documentId,
}: {
  readonly documentId: string | null | undefined
}) {
  useEffect(() => {
    setCurrentLibrary(documentId ?? null)

    return () => setCurrentLibrary(null)
  }, [documentId])

  return null
}
