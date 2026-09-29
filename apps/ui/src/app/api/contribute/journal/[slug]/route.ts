import { articleDraftHandlers } from "@/lib/article-draft-routes"

// /api/contribute/journal/[slug] — an editor's direct-edit draft of a
// Journal article. GET reads it, POST creates it, PATCH updates it.
const handlers = articleDraftHandlers({
  submissionType: "blog_submission",
  targetEntityType: "blog_article",
  capability: "journal.directEdit",
})

export const GET = handlers.GET
export const POST = handlers.POST
export const PATCH = handlers.PATCH
