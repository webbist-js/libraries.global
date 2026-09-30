import { NextResponse } from "next/server"

const originOf = (value: string | null | undefined): string | null => {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * Whether a state-changing request came from the site itself. `Origin` must
 * match the app's public origin; without it, `Referer` must. A request with
 * neither is refused: browsers send `Origin` on every cross-site and every
 * non-GET same-site request, so its absence means a non-browser caller that
 * can carry the session cookie only if it already has it.
 */
export function isSameOrigin(
  req: Request,
  appPublicUrl: string | undefined
): boolean {
  const expected = originOf(appPublicUrl)
  if (!expected) return false

  const origin = req.headers.get("origin")
  if (origin) return originOf(origin) === expected

  const referer = req.headers.get("referer")
  if (referer) return originOf(referer) === expected

  return false
}

export function sameOriginResponse() {
  return NextResponse.json(
    { error: "Cross-site request refused" },
    { status: 403 }
  )
}
