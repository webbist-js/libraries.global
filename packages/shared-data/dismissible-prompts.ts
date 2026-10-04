/**
 * Prompts a reader can hide. Signed out, a session cookie hides one until
 * the browser closes; signed in, the profile's private `dismissedPrompts`
 * keeps it hidden until they turn it back on in Settings. Strapi and the UI
 * both accept only these keys.
 */
export const DISMISSIBLE_PROMPTS = ["find-contribute"] as const

export type DismissiblePrompt = (typeof DISMISSIBLE_PROMPTS)[number]

export function isDismissiblePrompt(
  value: unknown
): value is DismissiblePrompt {
  return (
    typeof value === "string" &&
    (DISMISSIBLE_PROMPTS as readonly string[]).includes(value)
  )
}
