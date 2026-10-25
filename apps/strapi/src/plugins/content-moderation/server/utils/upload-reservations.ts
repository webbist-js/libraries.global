import { randomUUID } from "node:crypto"

const RESERVATIONS = "plugin::content-moderation.upload-reservation"
const OWNERSHIP = "plugin::content-moderation.submission-upload"
const FILE = "plugin::upload.file"
const DAILY_FILES = 20
const DAILY_BYTES = 50 * 1024 * 1024
const DAY_MS = 24 * 60 * 60 * 1000
type Reservation = {
  documentId: string
  reservationId: string
  baUserId: string
  quotaDate: string
  bytes: number
  status: "reserved" | "completed" | "cancelled"
  expiresAt: string
  fileId?: number
  createdAt?: string
}

export class UploadReservationError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code)
  }
}

function utcDate(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

function matchesReservation(file: any, reservation: Reservation): boolean {
  const fileTime = new Date(file.createdAt).getTime()
  const reservationTime = new Date(reservation.createdAt ?? "").getTime()

  return (
    typeof file.name === "string" &&
    file.name.startsWith(`upload-${reservation.reservationId}.`) &&
    Number.isFinite(fileTime) &&
    Number.isFinite(reservationTime) &&
    fileTime >= reservationTime
  )
}

/** Mandatory shared database lock; a missing transaction/lock never becomes a soft cap. */
async function locked<T>(
  strapi: any,
  userId: string,
  day: string,
  work: () => Promise<T>
): Promise<T> {
  if (typeof strapi.db?.transaction !== "function")
    throw new UploadReservationError(503, "upload_quota_unavailable")

  return strapi.db.transaction(async ({ trx }: any) => {
    if (typeof trx?.raw !== "function")
      throw new UploadReservationError(503, "upload_quota_unavailable")
    await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `content-upload:${userId}:${day}`,
    ])

    return work()
  })
}

async function readReservation(
  strapi: any,
  userId: string,
  reservationId: string
): Promise<Reservation> {
  const row = await strapi.documents(RESERVATIONS).findFirst({
    filters: {
      reservationId: { $eq: reservationId },
      baUserId: { $eq: userId },
    },
  })
  if (!row)
    throw new UploadReservationError(404, "upload_reservation_not_found")

  return row
}

/** Legacy ownership rows count too, without double-counting completed reservations. */
async function dailyUsage(strapi: any, userId: string, day: string) {
  const reservations = await strapi.documents(RESERVATIONS).findMany({
    filters: {
      baUserId: { $eq: userId },
      quotaDate: { $eq: day },
      status: { $ne: "cancelled" },
    },
    fields: ["bytes", "status", "fileId"],
    limit: DAILY_FILES + 1,
  })
  const ownership = await strapi.documents(OWNERSHIP).findMany({
    filters: {
      baUserId: { $eq: userId },
      createdAt: {
        $gte: `${day}T00:00:00.000Z`,
        $lt: new Date(
          new Date(`${day}T00:00:00.000Z`).getTime() + DAY_MS
        ).toISOString(),
      },
    },
    fields: ["fileId"],
    limit: DAILY_FILES + 1,
  })
  const completedIds = new Set(
    reservations
      .filter((row: Reservation) => row.status === "completed")
      .map((row: Reservation) => row.fileId)
  )
  const legacyIds = [
    ...new Set<number>(
      ownership
        .map((row: { fileId: number }) => row.fileId)
        .filter((id: number) => !completedIds.has(id))
    ),
  ]
  let bytes = reservations.reduce(
    (sum: number, row: Reservation) => sum + Number(row.bytes),
    0
  )
  if (legacyIds.length) {
    const files = await strapi.documents(FILE).findMany({
      filters: { id: { $in: legacyIds } },
      fields: ["id", "size"],
      limit: legacyIds.length,
    })
    // Strapi stores decimal kilobytes, rounded to two decimal places.
    bytes += files.reduce(
      (sum: number, file: { size?: number }) =>
        sum + Math.ceil(Number(file.size ?? 0) * 1000),
      0
    )
  }

  return { files: reservations.length + legacyIds.length, bytes }
}

export async function reserveUpload(
  strapi: any,
  userId: string,
  bytes: number,
  purpose: string,
  now = Date.now()
) {
  if (
    !Number.isSafeInteger(bytes) ||
    bytes < 1 ||
    bytes > 10 * 1024 * 1024 ||
    !["article", "avatar", "submission", "cover"].includes(purpose)
  )
    throw new UploadReservationError(400, "invalid_upload_reservation")
  const day = utcDate(now)

  return locked(strapi, userId, day, async () => {
    const usage = await dailyUsage(strapi, userId, day)
    if (usage.files + 1 > DAILY_FILES)
      throw new UploadReservationError(429, "files")
    if (usage.bytes + bytes > DAILY_BYTES)
      throw new UploadReservationError(429, "bytes")
    const reservationId = randomUUID()
    // Unfinished attempts remain charged until UTC midnight. A process crash or
    // lost storage response cannot reset the quota by waiting for a short TTL.
    const expiresAt = new Date(
      (Math.floor(now / DAY_MS) + 1) * DAY_MS
    ).toISOString()
    await strapi.documents(RESERVATIONS).create({
      data: {
        reservationId,
        baUserId: userId,
        quotaDate: day,
        bytes,
        purpose,
        status: "reserved",
        expiresAt,
      },
    })

    return { reservationId, expiresAt }
  })
}

export async function completeUpload(
  strapi: any,
  userId: string,
  reservationId: string,
  fileId: number,
  now = Date.now(),
  displayName?: unknown
) {
  if (!Number.isSafeInteger(fileId) || fileId < 1)
    throw new UploadReservationError(400, "invalid_upload_file")
  if (
    displayName !== undefined &&
    (typeof displayName !== "string" ||
      !/^[\p{L}\p{N}_-][\p{L}\p{N}_ .-]{0,119}$/u.test(displayName))
  )
    throw new UploadReservationError(400, "invalid_upload_name")
  const initial = await readReservation(strapi, userId, reservationId)

  return locked(strapi, userId, initial.quotaDate, async () => {
    const reservation = await readReservation(strapi, userId, reservationId)
    if (reservation.status === "completed") {
      if (reservation.fileId !== fileId)
        throw new UploadReservationError(409, "upload_reservation_conflict")

      return { ok: true }
    }
    if (
      reservation.status !== "reserved" ||
      new Date(reservation.expiresAt).getTime() <= now
    )
      throw new UploadReservationError(409, "upload_reservation_expired")
    const file = await strapi.db.query(FILE).findOne({
      where: { id: fileId },
      select: ["id", "size", "name", "mime", "createdAt"],
    })
    if (
      !file ||
      !Number.isFinite(Number(file.size)) ||
      Number(file.size) <= 0 ||
      Math.ceil(Number(file.size) * 1000) > reservation.bytes + 5
    )
      throw new UploadReservationError(400, "upload_file_mismatch")
    if (
      !matchesReservation(file, reservation) ||
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        file.mime
      )
    )
      throw new UploadReservationError(400, "upload_file_mismatch")
    const existing = await strapi
      .documents(OWNERSHIP)
      .findFirst({ filters: { fileId: { $eq: fileId } } })
    if (existing && existing.baUserId !== userId)
      throw new UploadReservationError(403, "upload_not_owned")
    if (!existing)
      await strapi
        .documents(OWNERSHIP)
        .create({ data: { fileId, baUserId: userId } })
    if (typeof displayName === "string")
      await strapi.db.query(FILE).update({
        where: { id: fileId },
        data: { name: displayName },
      })
    await strapi.documents(RESERVATIONS).update({
      documentId: reservation.documentId,
      data: { status: "completed", fileId },
    })

    return { ok: true }
  })
}

/** Best-effort orphan removal uses the trusted bridge, keeping upload tokens create-only. */
export async function cancelUpload(
  strapi: any,
  userId: string,
  reservationId: string,
  fileId?: number
) {
  const initial = await readReservation(strapi, userId, reservationId)

  return locked(strapi, userId, initial.quotaDate, async () => {
    const reservation = await readReservation(strapi, userId, reservationId)
    if (reservation.status === "cancelled") return { ok: true }
    // An ambiguous completion may have committed: never remove a now-owned file.
    if (reservation.status === "completed") return { ok: true }
    if (fileId !== undefined) {
      if (!Number.isSafeInteger(fileId) || fileId < 1)
        throw new UploadReservationError(400, "invalid_upload_file")
      const existing = await strapi
        .documents(OWNERSHIP)
        .findFirst({ filters: { fileId: { $eq: fileId } } })
      if (existing)
        throw new UploadReservationError(409, "upload_already_owned")
      const file = await strapi.db
        .query(FILE)
        .findOne({ where: { id: fileId } })
      if (file) {
        if (!matchesReservation(file, reservation))
          throw new UploadReservationError(403, "upload_file_mismatch")
        await strapi.plugin("upload").service("upload").remove(file)
      }
    }
    await strapi.documents(RESERVATIONS).update({
      documentId: reservation.documentId,
      data: { status: "cancelled" },
    })

    return { ok: true }
  })
}
