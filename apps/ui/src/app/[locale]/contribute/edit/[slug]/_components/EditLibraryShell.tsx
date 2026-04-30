"use client"

import {
  AddLibraryWizard,
  type FormData,
} from "@/app/[locale]/contribute/add/_components/AddLibraryWizard"

interface EditLibraryShellProps {
  sessionUser: { id: string; name: string | null; email: string }
  initialData: Partial<FormData>
  targetDocumentId: string
  targetSlug: string
}

export function EditLibraryShell({
  sessionUser,
  initialData,
  targetDocumentId,
  targetSlug,
}: EditLibraryShellProps) {
  return (
    <AddLibraryWizard
      sessionUser={sessionUser}
      initialData={initialData}
      targetDocumentId={targetDocumentId}
      targetSlug={targetSlug}
    />
  )
}
