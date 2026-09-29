import { articleDraftHandlers } from "@/lib/article-draft-routes"

// POST /api/contribute/wiki/[slug]/finalize — send the draft to review.
export const POST = articleDraftHandlers({
  submissionType: "wiki_edit",
  targetEntityType: "wiki_article",
  capability: "docs.directEdit",
}).FINALIZE
