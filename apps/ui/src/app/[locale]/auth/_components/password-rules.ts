// apps/ui/src/app/[locale]/auth/_components/password-rules.ts
//
// One rule for every new password (sign-up, reset, change), matching what
// Better Auth enforces in lib/auth.ts.

import type { useTranslations } from "next-intl"
import * as z from "zod"

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/constants"

type PasswordTranslate = ReturnType<typeof useTranslations<"staticUi">>

export const newPasswordSchema = (t: PasswordTranslate) =>
  z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      t("auth.min_password", { count: PASSWORD_MIN_LENGTH })
    )
    .max(
      PASSWORD_MAX_LENGTH,
      t("auth.max_password", { count: PASSWORD_MAX_LENGTH })
    )

/** Better Auth's refusals of a new password, as a field message. */
export function newPasswordRefusal(
  code: string | undefined,
  t: PasswordTranslate
) {
  if (code === "PASSWORD_TOO_SHORT")
    return t("auth.min_password", { count: PASSWORD_MIN_LENGTH })
  if (code === "PASSWORD_TOO_LONG")
    return t("auth.max_password", { count: PASSWORD_MAX_LENGTH })

  return null
}
