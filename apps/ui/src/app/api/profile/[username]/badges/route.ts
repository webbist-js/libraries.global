import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export type EarnedBadge = {
  badgeId: string
  awardedAt: string
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  if (!SECRET) return NextResponse.json({ data: [] })

  const res = await fetch(
    `${STRAPI}/api/user-profiles/by-username/${encodeURIComponent(username)}/badges`,
    {
      headers: { "X-Service-Secret": SECRET },
      next: { revalidate: 60 },
    }
  )
  if (!res.ok) return NextResponse.json({ data: [] })

  const json = (await res.json()) as { data?: EarnedBadge[] }

  return NextResponse.json({ data: json.data ?? [] })
}
