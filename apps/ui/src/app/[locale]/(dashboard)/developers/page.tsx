import type { Metadata } from "next"

import {
  ApiWorkspacePage,
  type ApiWorkspaceQuery,
} from "@/components/developers/ApiWorkspacePage"

export const metadata: Metadata = {
  title: "Library data API",
  description:
    "Explore the Libraries Global API, read the request reference and try sample requests. Connect your application with the Team API add-on.",
}

export default async function DevelopersPage({
  searchParams,
}: {
  readonly searchParams: Promise<ApiWorkspaceQuery>
}) {
  return <ApiWorkspacePage section="overview" query={await searchParams} />
}
