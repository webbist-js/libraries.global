import { articleDraftHandlers } from "@/lib/article-draft-routes"

// /api/contribute/wiki/[slug] — an editor's direct-edit draft of a
// Knowledge article. GET reads it, POST creates it, PATCH updates it.
const handlers = articleDraftHandlers({
  submissionType: "wiki_edit",
  targetEntityType: "wiki_article",
  capability: "docs.directEdit",
})

export const GET = handlers.GET
export const POST = handlers.POST
export const PATCH = handlers.PATCH
