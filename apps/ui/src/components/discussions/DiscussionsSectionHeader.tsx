"use client"

import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { CommunitySectionHeader } from "@/app/[locale]/community/_components/CommunitySectionHeader"
import { Link } from "@/lib/navigation"

export function DiscussionsSectionHeader({
  onStart,
}: {
  onStart?: () => void
}) {
  const t = useTranslations("discussions")
  const primary =
    "inline-flex items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-5 py-3 font-semibold text-white"

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
          className="rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-5 py-3 font-semibold"
        >
          {t("myRecords")}
        </Link>
      </div>
    </CommunitySectionHeader>
  )
}
