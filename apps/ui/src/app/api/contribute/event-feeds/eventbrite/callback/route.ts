import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import { verifyState } from "@/lib/oauth-state"

export const dynamic = "force-dynamic"

const STRAPI = () => process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const COOKIE = "__Host-eb_oauth"

type ExchangeResult = {
  data?: {
    credentialDocumentId: string
    organizations: { id: string; name: string }[]
    completed?:
      | { submissionDocumentId: string; result: string }
      | { error: { status: number; name: string; message: string } }
  }
  error?: { status: number; name: string; message: string }
}

/**
 * Finishes the Eventbrite OAuth round trip: checks the signed `state`
 * against the `__Host-eb_oauth` cookie, exchanges the code with Strapi, and
 * sends the librarian on to the right next step. The cookie is cleared on
 * every outcome.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code") ?? ""
  const state = url.searchParams.get("state") ?? ""

  const redirectTo = async (path: string) => {
    const res = NextResponse.redirect(new URL(path, url), 302)
    res.cookies.delete(COOKIE)

    return res
  }

  const payload = state ? verifyState(state) : null
  const cookieStore = await cookies()
  const nonce = cookieStore.get(COOKIE)?.value

  const session = await getSessionSSR(await headers())
  const user = session?.user ?? null

  if (
    !code ||
    !payload ||
    !user ||
    payload.nonce !== nonce ||
    payload.userId !== user.id
  )
    return redirectTo("/contribute/events?oauth=failed")

  if (!process.env.STRAPI_BRIDGE_SECRET)
    return redirectTo("/contribute/events?oauth=failed")

  let body: ExchangeResult | null = null
  try {
    const res = await fetch(`${STRAPI()}/api/events/feeds/oauth/eventbrite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...bridgeUserHeaders(user),
      },
      body: JSON.stringify({
        code,
        libraryDocumentId: payload.libraryDocumentId,
      }),
      cache: "no-store",
    })
    body = (await res.json().catch(() => null)) as ExchangeResult | null
    if (!res.ok || !body?.data)
      return redirectTo("/contribute/events?oauth=failed")
  } catch {
    return redirectTo("/contribute/events?oauth=failed")
  }

  const { data } = body
  const library = encodeURIComponent(payload.libraryDocumentId)

  if (data.completed) {
    if ("error" in data.completed)
      return redirectTo(
        `/contribute/events?library=${library}&oauth=test_failed`
      )

    return redirectTo(`/contribute/events?library=${library}&oauth=sent`)
  }

  if (data.organizations.length > 1)
    return redirectTo(
      `/contribute/events/${data.credentialDocumentId}/organisation`
    )

  return redirectTo("/contribute/events?oauth=failed")
}
