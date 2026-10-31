import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { loadLibraryEditor } from "@/lib/library-editor-server"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json(
      { error: "Sign in to contribute." },
      { status: 401 }
    )
  const { slug } = await params
  if (!/^[a-z0-9-]{1,200}$/.test(slug))
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  const query = new URL(req.url).searchParams
  const data = await loadLibraryEditor(
    slug,
    session.user,
    query.get("locale") ?? undefined,
    query.get("step") ?? undefined
  )
  if (!data)
    return NextResponse.json({ error: "Library not found" }, { status: 404 })

  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
