import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function GET() {
  const res = await fetch(`${STRAPI}/api/topics/approved`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return NextResponse.json({ data: [] })
  const json = await res.json()

  return NextResponse.json(json)
}
