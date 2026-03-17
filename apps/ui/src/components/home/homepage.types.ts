import type { Data } from "@repo/strapi-types"

export type HomepageData =
  | Data.ContentType<"api::homepage.homepage">
  | null
  | undefined

export type HomepageContinentSummary = Pick<
  Data.ContentType<"api::continent.continent">,
  "code" | "documentId" | "id" | "name" | "slug"
> & {
  libraryCount: number
}
