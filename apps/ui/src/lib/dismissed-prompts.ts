import type { DismissiblePrompt } from "@repo/shared-data"

/**
 * Hiding a prompt (`@repo/shared-data` DISMISSIBLE_PROMPTS). A session cookie
 * hides it for everyone until the browser closes; a signed-in user's choice
 * is also saved to their profile (`dismissedPrompts`, carried on the
 * session) and lasts until they turn it back on in Settings.
 */
export const promptCookieName = (prompt: DismissiblePrompt): string =>
  `lg-hide-${prompt}`

/** Server: whether to leave the prompt out of the page. */
export function isPromptHidden(
  prompt: DismissiblePrompt,
  cookies: { has: (name: string) => boolean },
  user?: { dismissedPrompts?: readonly string[] } | null
): boolean {
  return (
    cookies.has(promptCookieName(prompt)) ||
    (user?.dismissedPrompts?.includes(prompt) ?? false)
  )
}

// document.cookie, not the Cookie Store API, which older Safari lacks.
const cookieAttributes = (): string =>
  `Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`

/** Browser: hide the prompt until the browser closes (no expiry). */
export function hidePromptForSession(prompt: DismissiblePrompt): void {
  // eslint-disable-next-line unicorn/no-document-cookie
  document.cookie = `${promptCookieName(prompt)}=1; ${cookieAttributes()}`
}

/** Browser: drop the session cookie, so only the saved setting counts. */
export function clearPromptCookie(prompt: DismissiblePrompt): void {
  // eslint-disable-next-line unicorn/no-document-cookie
  document.cookie = `${promptCookieName(prompt)}=; Max-Age=0; ${cookieAttributes()}`
}

/** Browser: save the choice to the signed-in user's settings. */
export async function savePromptSetting(
  prompt: DismissiblePrompt,
  dismissed: boolean
): Promise<boolean> {
  try {
    const res = await fetch("/api/profile/me/prompts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, dismissed }),
    })

    return res.ok
  } catch {
    return false
  }
}
