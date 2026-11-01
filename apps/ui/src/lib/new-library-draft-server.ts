import "server-only"

import type { Submission } from "@/hooks/useSubmissions"
import { userHeaders } from "@/lib/bridge-user-headers"

export async function loadNewLibraryDraft(
  id: string | undefined,
  user: Parameters<typeof userHeaders>[0],
  staff: boolean
): Promise<Submission | null> {
  if (!id) return null
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error("Invalid draft")
  const response = await fetch(
    `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/content-moderation/submissions/my?documentId=${encodeURIComponent(id)}`,
    { headers: userHeaders(user), cache: "no-store" }
  )
  if (!response.ok) throw new Error("Your saved draft could not be loaded.")
  const row = (await response.json()).data?.[0] as Submission | undefined
  if (
    !row ||
    row.documentId !== id ||
    row.submissionType !== "new_library" ||
    !["draft", "needs_info"].includes(row.status) ||
    Boolean(row.draftData?.staffCreation) !== staff
  )
    throw new Error("This draft is no longer available.")

  return row
}
