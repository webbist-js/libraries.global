import { DiscussionThreadSkeleton } from "@/components/discussions/DiscussionSkeleton"
import { Container } from "@/components/elementary/Container"

export default function DiscussionLoading() {
  return (
    <Container className="py-8 sm:py-10">
      <DiscussionThreadSkeleton />
    </Container>
  )
}
