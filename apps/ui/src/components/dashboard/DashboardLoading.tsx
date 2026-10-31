import { useTranslations } from "next-intl"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { MainContent } from "@/components/ds/MainContent"
import { Skeleton } from "@/components/ui/skeleton"

type Kind =
  | "home"
  | "knowledge"
  | "journal"
  | "article"
  | "libraries"
  | "location"
  | "library"
  | "events"
  | "networks"
  | "plans"
  | "onboarding"

function Lines() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

function Card({ image = false }: { readonly image?: boolean }) {
  return (
    <div className="min-w-0 space-y-5 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-5">
      {image ? (
        <Skeleton className="aspect-video w-full" />
      ) : (
        <Skeleton className="size-9 rounded-xl" />
      )}
      <Skeleton className="h-6 w-4/5" />
      <Lines />
    </div>
  )
}

/** Fits inside persistent Staff/Contribute/Community layouts without adding
 * another sidebar, header or fake controls. No previous account data is reused. */
export function WorkspaceLoading({
  rows = false,
}: {
  readonly rows?: boolean
}) {
  const t = useTranslations("ui")

  return (
    <div className="min-w-0 py-6">
      <span role="status" className="sr-only">
        {t("loading")}
      </span>
      <div aria-busy="true" aria-hidden="true" className="grid min-w-0 gap-5">
        <div className="space-y-5 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-6 sm:p-8">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-2/3" />
          <Lines />
        </div>
        {rows ? (
          <div className="grid gap-3">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <Card key={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** A page-shaped fallback: the real 320px context rail, pinned CTA, toolbar,
 * contained hero and responsive reading/results columns. */
function LoadingOverview({
  kind,
  articleImage,
}: {
  kind: Kind
  articleImage: boolean
}) {
  const article = kind === "article"
  const record = kind === "location" || kind === "library"
  if (kind === "onboarding")
    return (
      <div className="grid gap-5">
        {[0, 1, 2].map((field) => (
          <div
            key={field}
            className="space-y-4 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-6"
          >
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    )
  if (article)
    return (
      <div className="space-y-7 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-6 sm:p-10">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
        <Lines />
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-3 w-40" />
        </div>
        {articleImage ? <Skeleton className="aspect-video w-full" /> : null}
        {[0, 1, 2].map((p) => (
          <Lines key={p} />
        ))}
      </div>
    )
  if (record)
    return (
      <>
        <div className="grid gap-6 rounded-[20px] bg-(--t-bg-deep) p-6 sm:grid-cols-2">
          <div className="space-y-5">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-12 w-full" />
            <Lines />
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>
          <Skeleton className="min-h-48 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((stat) => (
            <Skeleton key={stat} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Card />
        <Card />
      </>
    )
  if (kind === "plans")
    return (
      <>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-7 w-52" />
        <div className="grid gap-4 md:grid-cols-2">
          <Card />
          <Card />
        </div>
      </>
    )
  if (kind === "events")
    return (
      <div className="grid gap-3">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    )

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((card) => (
        <Card key={card} image={kind === "journal" || kind === "libraries"} />
      ))}
    </div>
  )
}

export function DashboardLoading({
  kind = "location",
  articleImage = false,
}: {
  readonly kind?: Kind
  readonly articleImage?: boolean
}) {
  const t = useTranslations("ui")
  const article = kind === "article"
  const record = kind === "location" || kind === "library"
  const aside =
    article || record || kind === "knowledge" || kind === "onboarding"

  return (
    <DashboardPage
      title={t("loading")}
      navigationHidden={kind === "home"}
      navigationLoading
      navigationHeading={
        <div aria-hidden="true" className="space-y-4">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-9 w-4/5" />
        </div>
      }
      navigation={
        <div aria-hidden="true" className="space-y-5 p-5">
          {!record && kind !== "plans" && kind !== "onboarding" ? (
            <Skeleton className="h-10 w-full rounded-full" />
          ) : null}
          {Array.from({ length: kind === "plans" ? 4 : 6 }, (_, item) => (
            <div key={item} className="flex items-center gap-3">
              <Skeleton className="size-7 shrink-0 rounded-lg" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      }
      navigationFooter={
        <div aria-hidden="true" className="flex items-start gap-3 py-1">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      }
      className={`dashboard-record-page ${aside ? "" : "dashboard-record-without-context"}`}
    >
      <span role="status" className="sr-only">
        {t("loading")}
      </span>
      <MainContent aria-busy="true">
        <div aria-hidden="true">
          <div className="flex min-h-14 items-center justify-between gap-4 border-b border-(--t-border-line) px-5">
            <Skeleton className="h-3 w-48 max-w-[60%]" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div
            className={`dashboard-record-grid ${!article && !record ? "dashboard-record-grid-with-header" : ""}`}
          >
            {!article && !record ? (
              <div className="dashboard-record-header space-y-5">
                <div className="grid gap-7 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-6 sm:p-8 xl:grid-cols-2">
                  <div className="space-y-5">
                    <Skeleton className="h-6 w-40 rounded-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-4/5" />
                  </div>
                  <div className="flex flex-col justify-end gap-5">
                    <Lines />
                    <Skeleton className="h-12 w-full rounded-full" />
                  </div>
                </div>
                {kind !== "plans" ? (
                  <Skeleton className="h-11 w-full rounded-full" />
                ) : null}
              </div>
            ) : null}
            <div className="dashboard-record-overview min-w-0 space-y-5">
              <LoadingOverview kind={kind} articleImage={articleImage} />
            </div>
            {aside ? (
              <div className="dashboard-record-aside space-y-5">
                <Card />
                <Card />
              </div>
            ) : null}
          </div>
        </div>
      </MainContent>
    </DashboardPage>
  )
}
