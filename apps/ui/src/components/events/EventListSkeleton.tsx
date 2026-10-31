import { useTranslations } from "next-intl"

import { Skeleton } from "@/components/ui/skeleton"

/** Matches agenda/timeline rows instead of replacing the list with a spinner. */
export function EventListSkeleton() {
  const t = useTranslations("ui")

  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden="true" className="grid gap-3">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex min-h-24 items-center gap-4 rounded-[18px] border border-(--t-border-line) bg-(--t-bg-deep) p-4"
          >
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="grid flex-1 gap-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
