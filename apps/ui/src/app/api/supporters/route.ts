import { NextResponse } from "next/server"

import {
  fetchSupporters,
  type SupportersQuery,
} from "@/lib/community/supporters-server"

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const query: SupportersQuery = {}
  for (const key of ["q", "country", "region", "sort", "page"] as const) {
    const value = params.get(key)
    if (value) query[key] = value
  }
  const data = await fetchSupporters(query)

  return NextResponse.json(
    { data },
    {
      status: data ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  )
}
