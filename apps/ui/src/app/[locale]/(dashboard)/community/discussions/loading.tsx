import { DiscussionListSkeleton } from "@/components/discussions/DiscussionSkeleton"
import { DiscussionsSectionHeader } from "@/components/discussions/DiscussionsSectionHeader"
import { Container } from "@/components/elementary/Container"

export default function DiscussionsLoading() {
  return (
    <>
      <DiscussionsSectionHeader />
      <Container className="grid gap-8 py-8 sm:py-10">
        <div className="lg:pr-[348px]">
          <DiscussionListSkeleton />
        </div>
      </Container>
    </>
  )
}
