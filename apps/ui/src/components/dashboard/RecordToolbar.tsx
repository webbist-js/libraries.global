"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import { BetaFeedback } from "@/components/beta/BetaFeedback"
import { Breadcrumb, type BreadcrumbItem } from "@/components/ds/Breadcrumb"
import { SiteSearchTrigger } from "@/components/global/SiteSearch"
import { captureAnalyticsEvent } from "@/lib/analytics-events"
import { usePathname } from "@/lib/navigation"

/** Shared top-bar controls; sharing is explicitly enabled on article readers. */
export function RecordToolbar({
  items,
  labels,
  citeHref,
  share = false,
  shareContent,
}: {
  readonly items?: BreadcrumbItem[]
  readonly labels?: Record<string, string>
  readonly citeHref?: string
  readonly share?: boolean
  readonly shareContent?: {
    contentType: "journal" | "knowledge"
    contentId: string
  }
}) {
  const t = useTranslations("dashboard")
  const ui = useTranslations("ui")
  const pathname = usePathname()
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  // These pages use the global navigation drawer instead of content controls.
  if (pathname === "/" || pathname === "/about") return null

  return (
    <div className="record-toolbar">
      <Breadcrumb items={items} labels={labels} />
      <div className="record-toolbar-actions">
        <BetaFeedback label={ui("feedback")} inline />
        <SiteSearchTrigger />
        {share ? (
          <button
            type="button"
            onClick={async () => {
              const measured = shareContent
                ? captureAnalyticsEvent("share", {
                    interaction_source: "article_share",
                    method: "copy",
                    content_type: shareContent.contentType,
                    content_id: shareContent.contentId,
                  })
                : undefined
              try {
                await navigator.clipboard.writeText(window.location.href)
                measured?.()
                setCopied(true)
                setFailed(false)
              } catch {
                setFailed(true)
              }
            }}
            aria-live="polite"
          >
            {failed ? t("copyFailed") : copied ? t("linkCopied") : t("share")}
          </button>
        ) : null}
        {citeHref ? <a href={citeHref}>{t("cite")}</a> : null}
      </div>
    </div>
  )
}
