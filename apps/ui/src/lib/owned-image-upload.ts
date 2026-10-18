import "server-only"

import { NextResponse } from "next/server"

import { toSafeImageFile, type SniffedImageType } from "./image-upload"
import { isSameOrigin, sameOriginResponse } from "./same-origin"
import { readUploadFile } from "./upload-body"
import {
  cancelUploadReservation,
  completeUploadReservation,
  reserveUploadQuota,
  type UploadPurpose,
} from "./upload-quota"
import { resolveUploadApiKey } from "./upload-token"

/** All three public upload adapters share bounded parsing, quota and durable ownership. */
export async function uploadOwnedImage(
  req: Request,
  user: { id: string },
  options: {
    field: "file" | "files"
    maxBytes: number
    allowed: readonly SniffedImageType[]
    purpose: UploadPurpose
  }
): Promise<
  | { ok: true; file: { id: number; url: string } }
  | { ok: false; response: NextResponse }
> {
  if (
    !isSameOrigin(
      req,
      process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL
    )
  )
    return { ok: false, response: sameOriginResponse() }
  const token = resolveUploadApiKey()
  if (!token || !process.env.STRAPI_BRIDGE_SECRET)
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Upload not configured" },
        { status: 503 }
      ),
    }
  const parsed = await readUploadFile(req, options.field, options.maxBytes)
  if (!parsed.ok) return parsed
  const safeFile = await toSafeImageFile(parsed.file, options.allowed)
  if (!safeFile)
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid image type or image data" },
        { status: 400 }
      ),
    }
  if (safeFile.size > options.maxBytes)
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Processed image is too large" },
        { status: 413 }
      ),
    }
  const quota = await reserveUploadQuota(
    user.id,
    safeFile.size,
    options.purpose
  )
  if (!quota.ok) return quota
  const reservationId = quota.reservation.reservationId
  const form = new FormData()
  // Bind the stored media's server-chosen name to this reservation. A legacy
  // bridge caller cannot claim a pre-existing or another upload's fileId.
  const extension = safeFile.name.split(".").at(-1)
  form.append("files", safeFile, `upload-${reservationId}.${extension}`)
  let response: Response
  try {
    response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/upload`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(15000),
      }
    )
  } catch {
    // Storage may have committed: keep this attempt charged instead of allowing unlimited retries.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Upload outcome unknown. Try again later." },
        { status: 503 }
      ),
    }
  }
  if (!response.ok)
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Upload failed. Try again later." },
        { status: 502 }
      ),
    }
  let uploaded: unknown
  try {
    uploaded = await response.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Upload returned an invalid response" },
        { status: 502 }
      ),
    }
  }
  const file =
    Array.isArray(uploaded) && uploaded.length === 1
      ? (uploaded[0] as { id?: unknown; url?: unknown })
      : null
  if (
    !file ||
    !Number.isSafeInteger(file.id) ||
    Number(file.id) < 1 ||
    typeof file.url !== "string" ||
    !file.url
  )
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Upload returned no usable file" },
        { status: 502 }
      ),
    }
  const fileId = Number(file.id)
  if (!(await completeUploadReservation(user.id, reservationId, fileId))) {
    const cleaned = await cancelUploadReservation(
      user.id,
      reservationId,
      fileId
    )
    if (!cleaned)
      console.error(
        "[upload] Ownership recording and orphan cleanup require retry",
        reservationId
      )

    return {
      ok: false,
      response: NextResponse.json(
        { error: "Upload could not be recorded. Please try again." },
        { status: 503 }
      ),
    }
  }

  return { ok: true, file: { id: fileId, url: file.url } }
}
