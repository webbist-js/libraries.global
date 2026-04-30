import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

export const revalidate = 3600 // 1-hour ISR

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const qs = searchParams.toString()

  try {
    const res = await fetch(
      `${STRAPI}/api/rewards/leaderboard${qs ? `?${qs}` : ""}`,
      {
        next: { revalidate: 3600 },
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )

    if (!res.ok) {
      return NextResponse.json({ data: [] }, { status: res.status })
    }

    const json = await res.json()

    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ data: [] }, { status: 500 })
  }
}
