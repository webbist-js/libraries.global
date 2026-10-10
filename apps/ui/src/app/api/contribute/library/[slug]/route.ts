import { NextResponse } from "next/server"
import type { Locale } from "next-intl"

import { toCorrectionRecord } from "@/components/contribute/correction.logic"
import { prefillLibrary } from "@/components/library-editor/wizard.prefill"
import { fetchLibraryForEditing } from "@/lib/strapi-api/content/server"

/**
 * The published values a correction starts from: the fields the
 * correction editors change, and the linked options with their names. The
 * same data is public on the library page. `?shape=wizard` returns the
 * record in the Index editor's form shape instead, so the staff editor can
 * reload one field another staff member changed.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,200}$/.test(slug))
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  const url = new URL(req.url)
  const locale = (url.searchParams.get("locale") ?? "en") as Locale
  const res = await fetchLibraryForEditing(slug, locale)
  if (!res?.data?.documentId)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(
    {
      data:
        url.searchParams.get("shape") === "wizard"
          ? prefillLibrary(res.data)
          : toCorrectionRecord(res.data),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
