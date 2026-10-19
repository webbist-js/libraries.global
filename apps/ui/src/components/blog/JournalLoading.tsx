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

/** Matches the Journal's editorial browsing and reading layouts. */
export function JournalLoading({
  article = false,
}: {
  readonly article?: boolean
}) {
  return (
    <EditorialLoading>
      {article ? <JournalArticleLoading /> : <JournalLandingLoading />}
    </EditorialLoading>
  )
}

function JournalLandingLoading() {
  return (
    <>
      <PageHeroSkeleton displayTitle />
      <LoadingSectionNavigation />
      <Container className="grid items-start gap-6 pt-8 pb-20 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-7">
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-5">
            <LoadingBlock className="w-32" />
            <LoadingBlock className="h-3 w-24" />
          </div>
          <LoadingPanel className="grid gap-6 p-2 md:grid-cols-[minmax(0,47fr)_minmax(0,53fr)]">
            <LoadingBlock className="aspect-[4/3] h-auto w-full rounded-[16px] md:aspect-auto md:min-h-[280px]" />
            <div className="flex min-w-0 flex-col justify-center px-4 pt-0 pb-5 md:py-5 md:pr-5 md:pl-0">
              <LoadingBlock className="mb-4 h-3 w-28" />
              <LoadingBlock className="h-8 w-full rounded-md" />
              <LoadingBlock className="mt-2 h-8 w-4/5 rounded-md" />
              <div className="mt-5">
                <LoadingParagraph short />
              </div>
              <div className="mt-6 flex items-center gap-2">
                <LoadingBlock className="size-7 shrink-0" />
                <LoadingBlock className="h-3 w-3/4" />
              </div>
            </div>
          </LoadingPanel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[0, 1].map((card) => (
              <StoryLoadingCard key={card} compact />
            ))}
          </div>
          <LoadingBlock className="mt-8 mb-4 w-28" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <StoryLoadingCard key={card} />
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          <LoadingPanel>
            <LoadingBlock className="mb-4 h-6 w-4/5" />
            <LoadingParagraph short />
            <LoadingBlock className="mt-6 mb-2 h-3 w-24" />
            <LoadingBlock className="h-11 w-full border border-(--t-border-line) bg-(--t-bg-surface)" />
            <LoadingBlock className="mt-3 h-11 w-28" />
            <LoadingBlock className="mt-4 h-3 w-4/5 bg-(--t-ink-dim)/8" />
          </LoadingPanel>
          <LoadingContributionCard />
        </div>
      </Container>
    </>
  )
}

function StoryLoadingCard({ compact = false }: { readonly compact?: boolean }) {
  return (
    <LoadingPanel className="flex flex-col">
      <LoadingBlock className="mb-4 h-3 w-20" />
      <LoadingBlock className="h-5 w-full" />
      <LoadingBlock className="mt-2 h-5 w-3/4" />
      {!compact ? (
        <div className="mt-4">
          <LoadingParagraph short />
        </div>
      ) : null}
      <LoadingBlock className="mt-6 h-3 w-4/5 bg-(--t-ink-dim)/8" />
    </LoadingPanel>
  )
}

function JournalArticleLoading() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pt-6 pb-20 sm:px-8 sm:pt-8">
      <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,860px)_240px]">
        <div className="min-w-0">
          <LoadingPanel className="rounded-[24px] p-5 sm:p-10 lg:p-12">
            <LoadingArticleHeader />
            <LoadingBlock className="mt-7 aspect-video h-auto w-full rounded-[18px]" />
            <LoadingArticleBody />
            <div className="mt-8 rounded-[16px] bg-(--t-bg-void) p-5">
              <div className="flex items-center gap-3">
                <LoadingBlock className="size-10 shrink-0" />
                <div className="grid flex-1 gap-3">
                  <LoadingBlock className="w-1/2" />
                  <LoadingBlock className="h-3 w-4/5" />
                </div>
              </div>
            </div>
            <LoadingBlock className="mt-6 h-3 w-32" />
          </LoadingPanel>
          <LoadingDiscussion />
          <LoadingBlock className="mt-10 mb-4 h-7 w-60 max-w-full" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <StoryLoadingCard key={card} />
            ))}
          </div>
        </div>
        <div className="hidden lg:block">
          <LoadingArticleAside />
        </div>
      </div>
    </div>
  )
}
