import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  completeUpload,
  reserveUpload,
} from "../../src/plugins/content-moderation/server/utils/upload-reservations"
import { setupStrapi, strapi, teardownStrapi } from "../helpers/strapi"

const RES = "plugin::content-moderation.upload-reservation"
const OWN = "plugin::content-moderation.submission-upload"
const FILE = "plugin::upload.file"
const prefix = `upload-acceptance-${randomUUID()}`
const users = [
  `${prefix}-concurrent`,
  `${prefix}-complete`,
  `${prefix}-rollback`,
]
const fileIds: number[] = []

/** Explicit opt-in and fixed disposable database boundary; never use a maintainer/production DB. */
describe.skipIf(process.env.COMMUNITY_UPLOAD_INTEGRATION !== "1")(
  "uploads on the full Strapi host and PostgreSQL",
  () => {
    let baseUrl: string
    beforeAll(async () => {
      const contents = readFileSync(".env", "utf8")
      const value = (name: string) =>
        process.env[name] ??
        contents
          .split("\n")
          .find((line) => line.startsWith(`${name}=`))
          ?.slice(name.length + 1)
          .replaceAll(/^['"]|['"]$/g, "")
      if (
        !["127.0.0.1", "localhost"].includes(value("DATABASE_HOST") ?? "") ||
        value("DATABASE_PORT") !== "5433" ||
        value("DATABASE_NAME") !== "community_publishing_acceptance"
      )
        throw new Error(
          "Upload integration requires the isolated local community publishing acceptance database"
        )
      await setupStrapi()
      const server = strapi.server.httpServer
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve)
      )
      const address = server.address()
      if (!address || typeof address === "string")
        throw new Error("HTTP fixture unavailable")
      baseUrl = `http://127.0.0.1:${address.port}`
    }, 60000)
    afterAll(async () => {
      if (baseUrl) {
        await strapi.db
          .query(OWN as any)
          .deleteMany({ where: { baUserId: { $in: users } } })
        await strapi.db
          .query(RES as any)
          .deleteMany({ where: { baUserId: { $in: users } } })
        if (fileIds.length)
          await strapi.db
            .query(FILE)
            .deleteMany({ where: { id: { $in: fileIds } } })
      }
      await teardownStrapi()
    }, 30000)

    const post = (
      userId: string,
      suffix: string,
      body: Record<string, unknown>
    ) =>
      fetch(`${baseUrl}/api/content-moderation/uploads/reservations${suffix}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": process.env.STRAPI_BRIDGE_SECRET!,
          "X-Ba-User-Id": userId,
        },
        body: JSON.stringify(body),
      })
    async function media(reservationId: string) {
      const file = await strapi.db.query(FILE).create({
        data: {
          name: `upload-${reservationId}.png`,
          hash: `acceptance-${randomUUID()}`,
          ext: ".png",
          mime: "image/png",
          size: 0.1,
          url: `/uploads/acceptance-${randomUUID()}.png`,
          provider: "local",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
      fileIds.push(file.id)

      return file.id
    }

    it("admits at most 20 simultaneous reservations across independent HTTP requests and upload purposes", async () => {
      const replies = await Promise.all(
        Array.from({ length: 25 }, (_, index) =>
          post(users[0], "", {
            bytes: 100,
            purpose: ["article", "avatar", "submission"][index % 3],
          })
        )
      )
      expect(replies.filter((reply) => reply.status === 200)).toHaveLength(20)
      expect(replies.filter((reply) => reply.status === 429)).toHaveLength(5)
      expect(
        await strapi.db
          .query(RES as any)
          .count({ where: { baUserId: users[0] } })
      ).toBe(20)
    })

    it("records ownership once across service and HTTP completion retries", async () => {
      const reservation = await reserveUpload(strapi, users[1], 100, "article")
      const fileId = await media(reservation.reservationId)
      await completeUpload(strapi, users[1], reservation.reservationId, fileId)
      const response = await post(users[1], "/complete", {
        reservationId: reservation.reservationId,
        fileId,
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
      expect(
        await strapi.db
          .query(OWN as any)
          .count({ where: { baUserId: users[1], fileId } })
      ).toBe(1)
      expect(
        (
          await strapi.db
            .query(RES as any)
            .findOne({ where: { reservationId: reservation.reservationId } })
        ).status
      ).toBe("completed")
    })

    it("rolls a real ownership insert back when the completion write fails, then recovers", async () => {
      const reservation = await reserveUpload(
        strapi,
        users[2],
        100,
        "submission"
      )
      const fileId = await media(reservation.reservationId)
      const failing = {
        db: strapi.db,
        documents: (uid: any) => {
          const service = strapi.documents(uid)

          return uid === RES
            ? {
                ...service,
                update: async () => {
                  throw new Error("Completion failure probe")
                },
              }
            : service
        },
      }
      await expect(
        completeUpload(failing, users[2], reservation.reservationId, fileId)
      ).rejects.toThrow("Completion failure probe")
      expect(
        await strapi.db
          .query(OWN as any)
          .count({ where: { baUserId: users[2], fileId } })
      ).toBe(0)
      expect(
        (
          await strapi.db
            .query(RES as any)
            .findOne({ where: { reservationId: reservation.reservationId } })
        ).status
      ).toBe("reserved")
      await completeUpload(strapi, users[2], reservation.reservationId, fileId)
      expect(
        await strapi.db
          .query(OWN as any)
          .count({ where: { baUserId: users[2], fileId } })
      ).toBe(1)
    })
  }
)
