import type { Locale } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import { FindSkeletonGrid } from "@/components/index-page/FindStates"
import { Skeleton } from "@/components/ui/skeleton"

export default async function LibrariesLoading() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("ui")])

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col bg-(--t-bg-void) text-(--t-ink-base)">
      <Suspense fallback={<div className="h-14 shrink-0" />}>
        <GlobalHeader locale={locale as Locale} />
      </Suspense>
      <MainContent className="flex flex-1 flex-col" aria-busy="true">
        <span role="status" className="sr-only">
          {t("loading_results")}
        </span>
        <PageHero
          breadcrumb={[
            { label: t("home"), href: "/" },
            { label: t("find_libraries") },
          ]}
          eyebrow="Library index"
          eyebrowIcon="mdi:map-search-outline"
          title="Find a library, *anywhere.*"
        >
          <div className="grid gap-2.5" aria-hidden="true">
            <Skeleton className="h-3 w-full rounded-full bg-(--t-border-line)" />
            <Skeleton className="h-3 w-full rounded-full bg-(--t-border-line)" />
            <Skeleton className="h-3 w-4/5 rounded-full bg-(--t-border-line)" />
          </div>
          <Skeleton className="h-14 w-full rounded-full bg-(--t-border-line)" />
        </PageHero>
        <Container className="flex flex-1 items-start gap-8 pt-8 pb-[88px]">
          <div
            aria-hidden="true"
            className="hidden w-[290px] shrink-0 gap-7 lg:grid"
          >
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="grid gap-4 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-5"
              >
                <Skeleton className="h-4 w-1/2 rounded-full bg-(--t-border-line)" />
                <Skeleton className="h-3 w-4/5 rounded-full bg-(--t-border-line)" />
                <Skeleton className="h-3 w-2/3 rounded-full bg-(--t-border-line)" />
              </div>
            ))}
          </div>
          <div className="grid min-w-0 flex-1 gap-6">
            <div
              aria-hidden="true"
              className="flex items-center justify-between gap-4"
            >
              <Skeleton className="h-5 w-32 rounded-full bg-(--t-border-line)" />
              <Skeleton className="h-10 w-40 rounded-full bg-(--t-border-line)" />
            </div>
            <FindSkeletonGrid />
          </div>
        </Container>
      </MainContent>
    </div>
  )
}
