import { isValidServiceSecret } from "../utils/service-secret"
import {
  cancelUpload,
  completeUpload,
  reserveUpload,
  UploadReservationError,
} from "../utils/upload-reservations"

export default ({ strapi }: { strapi: any }) => {
  const handle = async (
    ctx: any,
    action: (userId: string, body: Record<string, unknown>) => Promise<unknown>
  ) => {
    if (!isValidServiceSecret(ctx.request.headers["x-service-secret"]))
      return ctx.unauthorized("Service secret required")
    const userId = ctx.request.headers["x-ba-user-id"]
    if (typeof userId !== "string" || !userId.trim() || userId.length > 256)
      return ctx.badRequest("X-Ba-User-Id required")
    ctx.set("Cache-Control", "no-store")
    try {
      ctx.body = await action(userId, ctx.request.body ?? {})
    } catch (error) {
      if (error instanceof UploadReservationError) {
        ctx.status = error.status
        ctx.body = { error: error.code }

        return
      }
      strapi.log.error("[uploads] Reservation operation failed")
      ctx.status = 503
      ctx.body = { error: "upload_quota_unavailable" }
    }
  }
  const reservationId = (body: Record<string, unknown>) => {
    if (
      typeof body.reservationId !== "string" ||
      !/^[0-9a-f-]{36}$/.test(body.reservationId)
    )
      throw new UploadReservationError(400, "invalid_upload_reservation")

    return body.reservationId
  }

  return {
    reserve: (ctx: any) =>
      handle(ctx, (userId, body) =>
        reserveUpload(strapi, userId, Number(body.bytes), String(body.purpose))
      ),
    complete: (ctx: any) =>
      handle(ctx, (userId, body) =>
        completeUpload(
          strapi,
          userId,
          reservationId(body),
          Number(body.fileId),
          undefined,
          body.displayName
        )
      ),
    cancel: (ctx: any) =>
      handle(ctx, (userId, body) =>
        cancelUpload(
          strapi,
          userId,
          reservationId(body),
          body.fileId === undefined ? undefined : Number(body.fileId)
        )
      ),
  }
}
