// apps/ui/src/app/[locale]/auth/_components/password-rules.ts
//
// One rule for every new password (sign-up, reset, change), matching what
// Better Auth enforces in lib/auth.ts.

import * as z from "zod"

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/constants"

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(
    PASSWORD_MAX_LENGTH,
    `Keep it to ${PASSWORD_MAX_LENGTH} characters or fewer`
  )

/** Better Auth's refusals of a new password, as a field message. */
export function newPasswordRefusal(code: string | undefined) {
  if (code === "PASSWORD_TOO_SHORT")
    return `Use at least ${PASSWORD_MIN_LENGTH} characters`
  if (code === "PASSWORD_TOO_LONG")
    return `Keep it to ${PASSWORD_MAX_LENGTH} characters or fewer`

  return null
}
