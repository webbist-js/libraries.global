import "server-only"

import { bridgeUserHeaders } from "@/lib/bridge-user-headers"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

type SessionUser = { id: string; email: string; name?: string | null }

/**
 * `GET /drives/:documentId/holds` — the libraries currently held in this
 * drive by someone else, and the one (if any) the reader holds themself.
 * Empty on any failure (network, non-OK, bad JSON): a hold is a courtesy,
 * never a gate the list depends on to render.
 */
export async function fetchHolds(
  documentId: string,
  user: SessionUser | null
): Promise<{ heldByOthers: string[]; mine: string | null }> {
  try {
    const res = await fetch(
      `${STRAPI}/api/drives/${encodeURIComponent(documentId)}/holds`,
      {
        cache: "no-store",
        headers: user
          ? bridgeUserHeaders(user)
          : { "X-Service-Secret": process.env.STRAPI_BRIDGE_SECRET ?? "" },
      }
    )
    if (!res.ok) return { heldByOthers: [], mine: null }
    const json = (await res.json()) as {
      data?: { heldByOthers?: unknown; mine?: unknown }
    }
    const heldByOthers = Array.isArray(json.data?.heldByOthers)
      ? json.data.heldByOthers.filter((x): x is string => typeof x === "string")
      : []
    const mine = typeof json.data?.mine === "string" ? json.data.mine : null

    return { heldByOthers, mine }
  } catch {
    return { heldByOthers: [], mine: null }
  }
}

/**
 * `POST /drives/:documentId/holds` — place a 20-minute hold on a library
 * for the signed-in reader, releasing any other hold they had in this
 * drive. Mirrors Strapi's exact statuses: 200 on success, 409 when someone
 * else holds it, 422 when the drive isn't open, 404 when it doesn't exist.
 */
export async function placeHold(
  documentId: string,
  libraryDocumentId: string,
  user: SessionUser
): Promise<
  | { ok: true; expiresAt: string }
  | { ok: false; status: number; message: string }
> {
  try {
    const res = await fetch(
      `${STRAPI}/api/drives/${encodeURIComponent(documentId)}/holds`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          ...bridgeUserHeaders(user),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ libraryDocumentId }),
      }
    )
    const json = await res.json().catch(() => ({}) as Record<string, unknown>)
    if (!res.ok) {
      const error = (json as { error?: { message?: string } | string })?.error
      const message =
        (typeof error === "string" ? error : error?.message) ??
        "We couldn’t hold that library."

      return { ok: false, status: res.status, message }
    }
    const expiresAt = (json as { data?: { expiresAt?: unknown } }).data
      ?.expiresAt

    return {
      ok: true,
      expiresAt: typeof expiresAt === "string" ? expiresAt : "",
    }
  } catch {
    return { ok: false, status: 502, message: "We couldn’t hold that library." }
  }
}

/**
 * `DELETE /drives/:documentId/holds/:libraryDocumentId` — release the
 * reader's own hold. Swallows every failure: releasing early is a courtesy
 * (the hold expires on its own after 20 minutes regardless).
 */
export async function releaseHeld(
  documentId: string,
  libraryDocumentId: string,
  user: SessionUser
): Promise<void> {
  try {
    await fetch(
      `${STRAPI}/api/drives/${encodeURIComponent(documentId)}/holds/${encodeURIComponent(libraryDocumentId)}`,
      {
        method: "DELETE",
        cache: "no-store",
        headers: bridgeUserHeaders(user),
      }
    )
  } catch {
    // best effort
  }
}
