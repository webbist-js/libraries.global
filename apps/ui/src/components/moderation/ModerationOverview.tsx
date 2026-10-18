import { ArrowRight, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  REVIEW_ICONS,
  type WorkspaceView,
} from "@/components/moderation/workspace"
import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"

export function ModerationOverview({
  views,
}: {
  views: readonly WorkspaceView[]
}) {
  const t = useTranslations("moderationWorkspace")

  return (
    <section aria-labelledby="review-overview" className="grid gap-5">
      <header>
        <h2
          id="review-overview"
          className="m-0 font-serif text-[32px] leading-tight font-medium"
        >
          {t("overviewTitle")}
        </h2>
        <p className="mt-2 mb-0 max-w-[75ch] text-[15px] leading-relaxed text-(--t-ink-dim)">
          {t("overviewLead")}
        </p>
      </header>
      <div
        className={cn(
          "grid gap-4",
          views.length > 1 && "md:grid-cols-2",
          views.length > 2 && "xl:grid-cols-3"
        )}
      >
        {views.map((view) => {
          const Icon = REVIEW_ICONS[view.id]

          return (
            <Link
              key={view.id}
              href={view.href}
              className="group flex min-w-0 flex-col gap-4 rounded-[24px] border border-(--t-border-line) bg-white p-6 text-(--t-ink-base) no-underline hover:border-[#b9b4f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)">
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="m-0 font-serif text-[26px] leading-tight font-medium">
                  {t(view.id)}
                </h3>
              </div>
              <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
                {t(`${view.id}Lead`)}
              </p>
              <div className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-(--t-border-line) pt-4">
                {view.pending === null ? (
                  <span className="text-sm text-(--t-ink-dim)">
                    {t("countUnavailable")}
                  </span>
                ) : (
                  <>
                    <span className="font-serif text-[36px] leading-none tabular-nums">
                      {view.pending}
                    </span>
                    <span className="text-sm text-(--t-ink-dim)">
                      {t("waitingForReview")}
                    </span>
                  </>
                )}
                {view.needsChanges != null && view.needsChanges > 0 && (
                  <span className="w-full text-xs text-(--t-ink-dim)">
                    {t("waitingForChanges", { count: view.needsChanges })}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center justify-between gap-2 text-sm font-semibold text-(--t-accent-primary)">
                {t("openQueue")}
                <ArrowRight size={17} aria-hidden />
              </span>
            </Link>
          )
        })}
      </div>
      <p className="m-0 flex items-start gap-2 text-sm leading-relaxed text-(--t-ink-dim)">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
        {t("overviewPrivacy")}
      </p>
    </section>
  )
}
