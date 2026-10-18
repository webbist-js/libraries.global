import { DiscussionThreadSkeleton } from "@/components/discussions/DiscussionSkeleton"
import { DiscussionsSectionHeader } from "@/components/discussions/DiscussionsSectionHeader"
import { Container } from "@/components/elementary/Container"

export default function DiscussionLoading() {
  return (
    <>
      <DiscussionsSectionHeader />
      <Container className="py-8 sm:py-10">
        <DiscussionThreadSkeleton />
      </Container>
    </>
  )
}
