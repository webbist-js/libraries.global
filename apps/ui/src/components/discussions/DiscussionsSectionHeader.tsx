"use client"

import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { CommunitySectionHeader } from "@/app/[locale]/(dashboard)/community/_components/CommunitySectionHeader"
import { buttonVariants } from "@/components/ui/button"
import { Link } from "@/lib/navigation"

export function DiscussionsSectionHeader({
  onStart,
}: {
  onStart?: () => void
}) {
  const t = useTranslations("discussions")
  const primary = buttonVariants({
    variant: "primary",
    size: "pill",
    className: "px-5",
  })

  return (
    <CommunitySectionHeader
      section={t("threads")}
      title={t("heroTitle").replace(" *", "\n*")}
      lead={t("lead")}
      displayTitle
    >
      <div className="flex flex-wrap gap-3">
        {onStart ? (
          <button type="button" onClick={onStart} className={primary}>
            <Plus size={17} aria-hidden />
            {t("newThread")}
          </button>
        ) : (
          <Link href="/community/discussions?compose=1" className={primary}>
            <Plus size={17} aria-hidden />
            {t("newThread")}
          </Link>
        )}
        <Link
          href="/contribute/submissions?tab=discussions"
          className={buttonVariants({
            variant: "surface",
            size: "pill",
            className: "px-5",
          })}
        >
          {t("myRecords")}
        </Link>
      </div>
    </CommunitySectionHeader>
  )
}
