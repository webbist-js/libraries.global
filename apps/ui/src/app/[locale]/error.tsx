"use client"

import * as Sentry from "@sentry/nextjs"
import { TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  utilityButtonClass,
  UtilityHeading,
  UtilityLink,
  UtilityPage,
} from "@/components/utility/UtilityPage"
import { T } from "@/lib/design-tokens"

interface Props {
  readonly error: Error & { digest?: string }
  readonly reset: () => void
}

export default function ErrorPage({ error, reset }: Props) {
  const t = useTranslations("errors.global")
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <UtilityPage>
      <UtilityHeading
        title={t("heading")}
        italic={t("headingItalic")}
        description={t("recovery")}
        icon={<TriangleAlert size={28} />}
        tone="warn"
      />
      <div className="flex flex-wrap gap-3">
        <Button type="button" className={utilityButtonClass} onClick={reset}>
          {t("tryAgain")}
        </Button>
        <Button asChild variant="outline" className={utilityButtonClass}>
          <UtilityLink href="/">{t("homepage")}</UtilityLink>
        </Button>
      </div>
      <p
        className="mt-6 text-sm leading-relaxed [overflow-wrap:anywhere]"
        style={{ color: T.ink.dim }}
      >
        {t("support")}{" "}
        <a
          href="mailto:info@libraries.global"
          data-contact-type="report_issue"
          className="underline underline-offset-4"
          style={{ color: T.accent.primary }}
        >
          info@libraries.global
        </a>
        .
        {error.digest && (
          <>
            {" "}
            {t("reference")}: <strong>{error.digest}</strong>.
          </>
        )}
      </p>
    </UtilityPage>
  )
}
