import { articleDraftHandlers } from "@/lib/article-draft-routes"

// POST /api/contribute/journal/[slug]/finalize — send the draft to review.
export const POST = articleDraftHandlers({
  submissionType: "blog_submission",
  targetEntityType: "blog_article",
  capability: "journal.directEdit",
}).FINALIZE
