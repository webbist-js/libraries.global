"use client"

import type { DismissiblePrompt } from "@repo/shared-data"
import { useCallback, useState } from "react"

import { useHydratedSession } from "@/lib/access-client"
import { savePromptSetting } from "@/lib/dismissed-prompts"

const PROMPT: DismissiblePrompt = "atlas-data-gap"

/**
 * Whether the Atlas opens a data-gap explanation by itself. Signed in, hiding
 * it is saved to the profile (`dismissedPrompts`) and Settings turns it back
 * on; signed out, it lasts for this visit only and nothing is stored. The
 * "Data gap details" button stays either way.
 */
export function useAtlasDataGapPrompt() {
  const { data, isPending } = useHydratedSession()
  const user = data?.user as { dismissedPrompts?: unknown } | undefined
  const signedIn = Boolean(user)
  const saved =
    Array.isArray(user?.dismissedPrompts) &&
    user.dismissedPrompts.includes(PROMPT)
  const [hiddenThisVisit, setHiddenThisVisit] = useState(false)

  /** Resolves false when a signed-in choice could not be saved. */
  const hide = useCallback(async () => {
    if (signedIn && !(await savePromptSetting(PROMPT, true))) return false
    setHiddenThisVisit(true)

    return true
  }, [signedIn])

  return {
    /** Wait for the session, so a saved choice never flashes the dialog. */
    ready: !isPending,
    hidden: saved || hiddenThisVisit,
    signedIn,
    hide,
  }
}
