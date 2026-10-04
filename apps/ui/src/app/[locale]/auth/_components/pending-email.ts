// apps/ui/src/app/[locale]/auth/_components/pending-email.ts
//
// The address an auth email just went to, kept in this tab's sessionStorage
// so the "check your inbox" pages can name it without putting an email
// address in the URL, where it would reach server logs and analytics.

import { useSyncExternalStore } from "react"

const KEY = "lg.auth.pendingEmail"

export function rememberPendingEmail(email: string): void {
  try {
    sessionStorage.setItem(KEY, email.trim())
  } catch {
    // Storage blocked: the pages fall back to "your email address".
  }
}

function readPendingEmail(): string | null {
  try {
    return sessionStorage.getItem(KEY) || null
  } catch {
    return null
  }
}

const noSubscribe = () => () => {}

/** The remembered address; null on the server, in another tab, or if blocked. */
export function usePendingEmail(): string | null {
  return useSyncExternalStore(noSubscribe, readPendingEmail, () => null)
}
