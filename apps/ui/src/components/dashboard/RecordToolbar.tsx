"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { AppearanceControl } from "@/components/appearance/AppearanceControl"
import { Breadcrumb, type BreadcrumbItem } from "@/components/ds/Breadcrumb"
import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import { SiteSearchTrigger } from "@/components/global/SiteSearch"
import { useHydratedSession } from "@/lib/access-client"
import { captureAnalyticsEvent } from "@/lib/analytics-events"
import { Link, usePathname } from "@/lib/navigation"

function ToolbarAccountAction() {
  const ui = useTranslations("ui")
  const session = useHydratedSession()
  if (session.isPending || session.error) return null

  return (
    <Link
      href={session.data?.user ? "/auth/signout" : "/auth/signin"}
      prefetch={false}
    >
      {ui(session.data?.user ? "sign_out" : "sign_in")}
    </Link>
  )
}

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
  const locale = useLocale()
  const pathname = usePathname()
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  // These pages use the global navigation drawer instead of content controls.
  if (pathname === "/" || pathname === "/about") return null

  return (
    <div className="record-toolbar">
      <Breadcrumb items={items} labels={labels} />
      <div className="record-toolbar-actions">
        <SiteSearchTrigger />
        <span className="record-appearance-control">
          <AppearanceControl />
        </span>
        <LocaleSwitcher
          locale={locale}
          triggerClassName="w-auto gap-1 rounded-full border-(--t-border-line) bg-(--t-bg-deep) px-3 text-sm font-medium uppercase text-(--t-ink-base) shadow-none hover:border-(--t-border-hi) [&_svg]:text-(--t-ink-base) [&_svg]:opacity-100"
        />
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
        ) : (
          <ToolbarAccountAction />
        )}
        {citeHref ? <a href={citeHref}>{t("cite")}</a> : null}
      </div>
    </div>
  )
}
