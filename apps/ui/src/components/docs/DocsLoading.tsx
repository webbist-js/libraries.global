import {
  EditorialLoading,
  LoadingArticleAside,
  LoadingArticleBody,
  LoadingArticleHeader,
  LoadingBlock,
  LoadingContributionCard,
  LoadingDiscussion,
  LoadingPanel,
  LoadingParagraph,
  LoadingSectionNavigation,
} from "@/components/articles/EditorialLoading"
import { PageHeroSkeleton } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"

/** Matches Knowledge's section cards, guide tree and article reading column. */
export function DocsLoading({
  article = false,
}: {
  readonly article?: boolean
}) {
  return (
    <EditorialLoading>
      {article ? <DocsArticleLoading /> : <DocsLandingLoading />}
    </EditorialLoading>
  )
}

function DocsLandingLoading() {
  return (
    <>
      <PageHeroSkeleton />
      <LoadingSectionNavigation knowledge />
      <Container className="grid items-start gap-6 py-8 pb-16 sm:pb-20 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <LoadingBlock className="mb-3 w-40" />
          <div className="mb-7 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <LoadingPanel key={card}>
                <LoadingBlock className="mb-4 size-9 rounded-xl" />
                <LoadingBlock className="mb-3 h-6 w-4/5" />
                <LoadingParagraph short />
              </LoadingPanel>
            ))}
          </div>
          <LoadingBlock className="mb-3 w-28" />
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((section) => (
              <LoadingPanel key={section}>
                <div className="mb-4 flex items-start gap-3">
                  <LoadingBlock className="size-9 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <LoadingBlock className="mb-3 h-6 w-3/4" />
                    <LoadingParagraph short />
                  </div>
                </div>
                {["w-4/5", "w-2/3", "w-3/4", "w-1/2"].map((width) => (
                  <div
                    key={width}
                    className="flex min-h-11 items-center justify-between gap-4 border-t border-(--t-divider) py-3"
                  >
                    <LoadingBlock className={`h-3 ${width}`} />
                    <LoadingBlock className="h-2.5 w-8 shrink-0 bg-(--t-ink-dim)/8" />
                  </div>
                ))}
                <LoadingBlock className="mt-4 h-3 w-28" />
              </LoadingPanel>
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          <LoadingPanel>
            <LoadingBlock className="mb-4 w-32" />
            {["w-4/5", "w-2/3", "w-[92%]", "w-3/4", "w-[84%]"].map((width) => (
              <div
                key={width}
                className="grid gap-2.5 border-t border-(--t-divider) py-3"
              >
                <LoadingBlock className={`h-3 ${width}`} />
                <LoadingBlock className="h-2.5 w-2/3 bg-(--t-ink-dim)/8" />
              </div>
            ))}
          </LoadingPanel>
          <LoadingContributionCard />
        </div>
      </Container>
    </>
  )
}

function DocsTreeLoading() {
  return (
    <div className="grid gap-5">
      <LoadingBlock className="h-10 w-full border border-(--t-border-line) bg-(--t-bg-deep)" />
      <div className="flex justify-between gap-3 py-3">
        <LoadingBlock className="h-3 w-24" />
        <LoadingBlock className="h-3 w-16" />
      </div>
      <div className="flex items-center gap-3">
        <LoadingBlock className="size-7 shrink-0 rounded-lg" />
        <LoadingBlock className="w-32" />
      </div>
      <div className="ml-3 grid gap-5 border-l border-(--t-border-line) py-2 pl-5">
        {["w-4/5", "w-full", "w-2/3", "w-[84%]", "w-3/4"].map((width) => (
          <LoadingBlock key={width} className={`h-3 ${width}`} />
        ))}
      </div>
      {[0, 1, 2, 3, 4].map((section) => (
        <div key={section} className="flex items-center gap-3">
          <LoadingBlock className="size-7 shrink-0 rounded-lg" />
          <LoadingBlock className="w-28" />
        </div>
      ))}
    </div>
  )
}

function DocsArticleLoading() {
  return (
    <div className="mx-auto grid w-full max-w-[1360px] grid-cols-1 items-start gap-6 px-4 pt-6 pb-16 sm:px-8 sm:pb-20 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_220px] xl:gap-8">
      <div className="hidden lg:block">
        <DocsTreeLoading />
      </div>
      <LoadingPanel className="flex items-center justify-between gap-4 rounded-[20px] py-4 lg:hidden">
        <LoadingBlock className="w-32" />
        <LoadingBlock className="size-4" />
      </LoadingPanel>
      <div className="min-w-0">
        <LoadingPanel className="rounded-[24px] p-5 sm:p-8 xl:p-10">
          <LoadingArticleHeader />
          <LoadingArticleBody />
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-(--t-divider) pt-5">
            <LoadingBlock className="w-40" />
            <LoadingBlock className="h-9 w-28" />
          </div>
        </LoadingPanel>
        <LoadingDiscussion />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((card) => (
            <LoadingPanel key={card}>
              <LoadingBlock className="mb-3 h-3 w-16" />
              <LoadingBlock className="h-5 w-4/5" />
            </LoadingPanel>
          ))}
        </div>
      </div>
      <div className="hidden xl:block">
        <LoadingArticleAside />
      </div>
    </div>
  )
}
