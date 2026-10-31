import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { MainContent } from "@/components/ds/MainContent"
import { SectionNavigation } from "@/components/ds/SectionNavigation"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/styles"

/** The site header remains usable; only the pending page is marked busy. */
export function EditorialLoading({
  children,
}: {
  readonly children: ReactNode
}) {
  const t = useTranslations("ui")

  return (
    <DashboardPage
      title={t("loading")}
      navigation={<LoadingBlock className="m-5 h-40" />}
      className="dashboard-editorial-page"
    >
      <div role="status" className="sr-only">
        {t("loading")}
      </div>
      <MainContent aria-busy="true" className="relative z-10 flex-1">
        <div aria-hidden="true" className="motion-reduce:[&_*]:animate-none">
          {children}
        </div>
      </MainContent>
    </DashboardPage>
  )
}

export function LoadingBlock({ className }: { readonly className?: string }) {
  return (
    <Skeleton
      className={cn("h-3.5 rounded-full bg-(--t-ink-dim)/12", className)}
    />
  )
}

export function LoadingPanel({
  children,
  className,
}: {
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-5",
        className
      )}
    >
      {children}
    </div>
  )
}

export function LoadingParagraph({
  short = false,
}: {
  readonly short?: boolean
}) {
  return (
    <div className="grid gap-3.5">
      {(short
        ? ["w-full", "w-4/5"]
        : ["w-full", "w-[94%]", "w-[96%]", "w-2/3"]
      ).map((width) => (
        <LoadingBlock
          key={width}
          className={`h-3 bg-(--t-ink-dim)/8 ${width}`}
        />
      ))}
    </div>
  )
}

/** Preserves the shared submenu's two-row mobile / single-row desktop layout. */
export function LoadingSectionNavigation({
  knowledge = false,
}: {
  readonly knowledge?: boolean
}) {
  const widths = knowledge
    ? ["w-28", "w-32", "w-30", "w-24", "w-34", "w-22"]
    : ["w-24", "w-36", "w-28"]

  return (
    <SectionNavigation>
      <div className="flex min-h-14 min-w-0 flex-1 items-center gap-7 overflow-hidden py-4">
        {widths.map((width) => (
          <LoadingBlock key={width} className={`shrink-0 ${width}`} />
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-(--t-divider) py-1.5 lg:border-t-0">
        <LoadingBlock className="h-11 w-32 border border-(--t-border-line) bg-(--t-bg-surface)" />
        <LoadingBlock className="h-11 w-24 border border-(--t-border-line) bg-(--t-bg-surface)" />
      </div>
    </SectionNavigation>
  )
}

export function LoadingArticleHeader() {
  return (
    <>
      <LoadingBlock className="h-3 w-40" />
      <div className="mt-5 grid gap-3">
        <LoadingBlock className="h-[clamp(34px,4vw,54px)] w-[92%] rounded-lg" />
        <LoadingBlock className="h-[clamp(34px,4vw,54px)] w-2/3 rounded-lg" />
      </div>
      <div className="mt-6">
        <LoadingParagraph short />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <LoadingBlock className="size-10 shrink-0" />
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2.5">
          <LoadingBlock className="h-3 w-40 max-w-full" />
          <LoadingBlock className="h-3 w-64 max-w-full bg-(--t-ink-dim)/8" />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-(--t-divider) py-3">
        <div className="flex items-center gap-2">
          <LoadingBlock className="h-3 w-10" />
          <LoadingBlock className="h-7 w-16" />
          <LoadingBlock className="h-7 w-14 bg-(--t-ink-dim)/8" />
        </div>
        <div className="flex gap-2">
          <LoadingBlock className="h-10 w-36 bg-(--t-ink-dim)/8" />
          <LoadingBlock className="h-10 w-20 bg-(--t-ink-dim)/8" />
        </div>
      </div>
    </>
  )
}

export function LoadingArticleBody() {
  return (
    <div className="mt-8 grid gap-8">
      <LoadingParagraph />
      <div>
        <LoadingBlock className="mb-5 h-6 w-1/2" />
        <LoadingParagraph />
      </div>
      <LoadingParagraph />
    </div>
  )
}

export function LoadingArticleAside() {
  return (
    <div className="grid gap-7 pt-2">
      <div>
        <LoadingBlock className="mb-4 h-3 w-24" />
        <div className="grid gap-4 border-l border-(--t-border-line) pl-4">
          {["w-4/5", "w-full", "w-2/3"].map((width) => (
            <LoadingBlock key={width} className={`h-3 ${width}`} />
          ))}
        </div>
      </div>
      <div>
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex justify-between gap-4 border-b border-(--t-divider) py-3"
          >
            <LoadingBlock className="h-3 w-16 bg-(--t-ink-dim)/8" />
            <LoadingBlock className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function LoadingDiscussion() {
  return (
    <LoadingPanel className="mt-5 flex flex-wrap items-center justify-between gap-5">
      <div className="grid w-full min-w-0 gap-3 sm:w-2/3">
        <LoadingBlock className="h-6 w-48 max-w-full" />
        <LoadingParagraph short />
      </div>
      <LoadingBlock className="h-11 w-36" />
    </LoadingPanel>
  )
}

export function LoadingContributionCard() {
  return (
    <LoadingPanel className="border-(--t-ink-base) bg-(--t-bg-inverse)">
      <LoadingBlock className="mb-4 h-6 w-4/5 bg-white/20" />
      <div className="grid gap-3">
        {["w-full", "w-[92%]", "w-2/3"].map((width) => (
          <LoadingBlock key={width} className={`h-3 bg-white/10 ${width}`} />
        ))}
      </div>
      <LoadingBlock className="mt-5 h-11 w-36 bg-white/30" />
    </LoadingPanel>
  )
}
