import { NextResponse } from "next/server"

/** Every upload route reserves the same durable Strapi/PostgreSQL daily budget. */
export const UPLOAD_QUOTA = { files: 20, bytes: 50 * 1024 * 1024 } as const
export type UploadPurpose = "article" | "submission" | "avatar"
export type UploadReservation = { reservationId: string; expiresAt: string }
export type QuotaReason = "files" | "bytes"

export function uploadQuotaResponse(reason: QuotaReason) {
  const limit =
    reason === "files"
      ? `${UPLOAD_QUOTA.files} files`
      : `${Math.round(UPLOAD_QUOTA.bytes / (1024 * 1024))} MB`

  return NextResponse.json(
    { error: `Daily upload limit reached (${limit}). Try again tomorrow.` },
    { status: 429 }
  )
}

async function bridge(
  userId: string,
  action: string,
  body: Record<string, unknown>
): Promise<Response | null> {
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return null
  try {
    return await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/content-moderation/uploads/reservations${action}`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": secret,
          "X-Ba-User-Id": userId,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      }
    )
  } catch {
    return null
  }
}

export async function reserveUploadQuota(
  userId: string,
  incomingBytes: number,
  purpose: UploadPurpose
): Promise<
  | { ok: true; reservation: UploadReservation }
  | { ok: false; response: NextResponse }
> {
  const response = await bridge(userId, "", { bytes: incomingBytes, purpose })
  let body: {
    reservationId?: string
    expiresAt?: string
    error?: string
  } | null = null
  try {
    body = response ? await response.json() : null
  } catch {
    /* Fail closed on malformed/unknown replies. */
  }
  if (
    response?.ok &&
    typeof body?.reservationId === "string" &&
    /^[0-9a-f-]{36}$/.test(body.reservationId) &&
    typeof body.expiresAt === "string" &&
    Number.isFinite(Date.parse(body.expiresAt))
  ) {
    return {
      ok: true,
      reservation: {
        reservationId: body.reservationId,
        expiresAt: body.expiresAt,
      },
    }
  }
  if (
    response?.status === 429 &&
    (body?.error === "files" || body?.error === "bytes")
  )
    return { ok: false, response: uploadQuotaResponse(body.error) }

  return {
    ok: false,
    response: NextResponse.json(
      { error: "Upload quota temporarily unavailable. Try again." },
      { status: 503 }
    ),
  }
}

/** Completion is idempotent on the server: retry ambiguous storage/bridge failures. */
export async function completeUploadReservation(
  userId: string,
  reservationId: string,
  fileId: number
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await bridge(userId, "/complete", {
      reservationId,
      fileId,
    })
    if (response?.ok) {
      try {
        if ((await response.json())?.ok === true) return true
      } catch {
        /* Retry an ambiguous reply. */
      }
    }
    if (response && response.status >= 400 && response.status < 500)
      return false
  }

  return false
}

/** Never release an unknown storage outcome; it stays charged until UTC midnight. */
export async function cancelUploadReservation(
  userId: string,
  reservationId: string,
  fileId?: number
): Promise<boolean> {
  const response = await bridge(userId, "/cancel", {
    reservationId,
    ...(fileId === undefined ? {} : { fileId }),
  })

  return response?.ok === true
}

/** Fast rejection is supplemented by the actual streaming byte limit. */
export function rejectOversizedRequest(
  req: Request,
  maxFileBytes: number
): NextResponse | null {
  const declared = Number(req.headers.get("content-length") ?? 0)
  if (Number.isFinite(declared) && declared > maxFileBytes + 64 * 1024)
    return NextResponse.json(
      {
        error: `File too large (max ${Math.round(maxFileBytes / (1024 * 1024))} MB)`,
      },
      { status: 413 }
    )

  return null
}
