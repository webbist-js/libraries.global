"use client"

import { useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export function OAuthProvider({
  params,
}: {
  params: { locale: string; provider: string }
}) {
  const locale = useLocale()
  const t = useTranslations("auth.oauth")
  const searchParams = useSearchParams()
  const [isPending, setIsPending] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<{ message?: string } | null>(null)

  // OAuth is now handled server-side; redirect immediately if session is present
  useEffect(() => {
    const accessToken = searchParams.get("access_token")

    if (!accessToken) {
      setIsPending(false)
      setIsError(true)
      setError({ message: "Missing access_token from OAuth redirect" })
      toast.error("Missing access_token from OAuth redirect")

      return
    }

    // Server-side OAuth sync complete — redirect to home
    setIsSuccess(true)
    setIsPending(false)
    globalThis.location.href = `/${locale}`

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        {isPending && (
          <div className="space-y-2">
            <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
            <p className="text-lg">{t("signingIn")}</p>
          </div>
        )}

        {isSuccess && (
          <div className="space-y-2">
            <p className="text-2xl">🎉</p>
            <p className="text-lg font-medium">{t("signedInSuccessfully")}</p>
            <p className="text-muted-foreground text-sm">{t("redirecting")}</p>
          </div>
        )}

        {isError && (
          <div className="space-y-2">
            <p className="text-2xl">🚨</p>
            <p className="text-lg font-medium">{t("errors.signInFailed")}</p>
            <p className="text-muted-foreground text-sm">
              {error?.message || "An unexpected error occurred"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
