import { NextResponse } from "next/server"

/**
 * Per-user daily upload quota, shared by the submission photo, avatar and
 * article image routes.
 *
 * Usage comes from every `UploadUsageSource` the route wires in, and the
 * highest count wins:
 * - `strapiUploadUsage` asks Strapi's content-moderation plugin
 *   (`GET /api/content-moderation/uploads/usage`, bridge secret plus
 *   `X-Ba-User-Id`, answering `{ files, bytes }` for the current UTC day
 *   from `cm_submission_uploads`). That endpoint doesn't exist yet: WP-B owns
 *   the plugin, so until it lands the source answers null and is ignored.
 * - `MemoryUploadLedger` records what this process has uploaded. It's per
 *   instance on Vercel, so on its own it's a soft cap.
 */

const MB = 1024 * 1024
const DAY = 24 * 60 * 60 * 1000

export const UPLOAD_QUOTA = { files: 20, bytes: 50 * MB } as const

export type UploadUsage = { files: number; bytes: number }

export interface UploadUsageSource {
  /** The user's usage for the UTC day containing `now`, or null if unknown. */
  usage: (userId: string, now: number) => Promise<UploadUsage | null>
}

type LedgerEntry = UploadUsage & { day: number }

const utcDay = (now: number) => Math.floor(now / DAY)

export class MemoryUploadLedger implements UploadUsageSource {
  private readonly entries = new Map<string, LedgerEntry>()
  private readonly maxUsers: number

  constructor({ maxUsers = 10_000 }: { maxUsers?: number } = {}) {
    this.maxUsers = maxUsers
  }

  get size(): number {
    return this.entries.size
  }

  record(userId: string, bytes: number, now: number): void {
    const day = utcDay(now)
    const current = this.entries.get(userId)
    this.entries.delete(userId)
    const entry =
      current && current.day === day
        ? { day, files: current.files + 1, bytes: current.bytes + bytes }
        : { day, files: 1, bytes }
    if (this.entries.size >= this.maxUsers) this.prune(day)
    this.entries.set(userId, entry)
  }

  async usage(userId: string, now: number): Promise<UploadUsage> {
    const entry = this.entries.get(userId)
    if (!entry || entry.day !== utcDay(now)) return { files: 0, bytes: 0 }

    return { files: entry.files, bytes: entry.bytes }
  }

  private prune(day: number) {
    for (const [key, entry] of this.entries)
      if (entry.day !== day) this.entries.delete(key)
    while (this.entries.size >= this.maxUsers) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }
}

const isUsage = (v: unknown): v is UploadUsage =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as UploadUsage).files === "number" &&
  typeof (v as UploadUsage).bytes === "number"

/** Strapi's count of the user's uploads today; null when it can't answer. */
export function strapiUploadUsage({
  strapiUrl,
  secret,
}: {
  strapiUrl: string
  secret: string | undefined
}): UploadUsageSource {
  return {
    async usage(userId) {
      if (!secret) return null
      try {
        const res = await fetch(
          `${strapiUrl}/api/content-moderation/uploads/usage`,
          {
            headers: { "X-Service-Secret": secret, "X-Ba-User-Id": userId },
            cache: "no-store",
          }
        )
        if (!res.ok) return null
        const json: unknown = await res.json()

        return isUsage(json) ? { files: json.files, bytes: json.bytes } : null
      } catch {
        return null
      }
    },
  }
}

export type QuotaReason = "files" | "bytes"

export async function checkUploadQuota({
  userId,
  incomingBytes,
  sources,
  quota = UPLOAD_QUOTA,
  now = Date.now(),
}: {
  userId: string
  incomingBytes: number
  sources: UploadUsageSource[]
  quota?: UploadUsage
  now?: number
}): Promise<{ ok: true } | { ok: false; reason: QuotaReason }> {
  const answers = await Promise.all(sources.map((s) => s.usage(userId, now)))
  const used = { files: 0, bytes: 0 }
  for (const answer of answers) {
    if (!answer) continue
    used.files = Math.max(used.files, answer.files)
    used.bytes = Math.max(used.bytes, answer.bytes)
  }

  if (used.files + 1 > quota.files) return { ok: false, reason: "files" }
  if (used.bytes + incomingBytes > quota.bytes)
    return { ok: false, reason: "bytes" }

  return { ok: true }
}

export function uploadQuotaResponse(reason: QuotaReason) {
  const limit =
    reason === "files"
      ? `${UPLOAD_QUOTA.files} files`
      : `${Math.round(UPLOAD_QUOTA.bytes / MB)} MB`

  return NextResponse.json(
    { error: `Daily upload limit reached (${limit}). Try again tomorrow.` },
    { status: 429 }
  )
}

// ── Default wiring for the routes ──────────────────────────────────────────

const globalForUploads = globalThis as typeof globalThis & {
  _uploadLedger?: MemoryUploadLedger
}

/** This process's record of uploads, shared by every upload route. */
export const uploadLedger: MemoryUploadLedger =
  (globalForUploads._uploadLedger ??= new MemoryUploadLedger())

/**
 * The 429 to return if `userId` may not upload `incomingBytes` more today,
 * else null. Reads env at call time so tests can stub it.
 */
export async function enforceUploadQuota(
  userId: string,
  incomingBytes: number
): Promise<NextResponse | null> {
  const result = await checkUploadQuota({
    userId,
    incomingBytes,
    sources: [
      uploadLedger,
      strapiUploadUsage({
        strapiUrl: process.env.STRAPI_URL ?? "http://127.0.0.1:1337",
        secret: process.env.STRAPI_BRIDGE_SECRET,
      }),
    ],
  })

  return result.ok ? null : uploadQuotaResponse(result.reason)
}

/** Count a finished upload against the user's day. */
export function recordUpload(userId: string, bytes: number): void {
  uploadLedger.record(userId, bytes, Date.now())
}

/**
 * 413 when the declared request size passes `maxFileBytes` (plus multipart
 * overhead), so an oversized upload is refused before `formData()` reads it.
 */
export function rejectOversizedRequest(
  req: Request,
  maxFileBytes: number
): NextResponse | null {
  const declared = Number(req.headers.get("content-length") ?? 0)
  const overhead = 64 * 1024
  if (Number.isFinite(declared) && declared > maxFileBytes + overhead)
    return NextResponse.json(
      { error: `File too large (max ${Math.round(maxFileBytes / MB)} MB)` },
      { status: 413 }
    )

  return null
}
