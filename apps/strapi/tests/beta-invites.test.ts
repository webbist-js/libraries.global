import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import createController from "../src/plugins/beta-invites/server/controller"
import {
  hashCode,
  openCode,
  sealCode,
} from "../src/plugins/beta-invites/server/credentials"
import createService, {
  INVITATION,
} from "../src/plugins/beta-invites/server/service"
import plugin from "../src/plugins/beta-invites/strapi-server"

const SUBSCRIBER = "api::subscriber.subscriber"
const NOTIFICATION = "api::notification.notification"
const id = "s".repeat(24)
let rows: Record<string, any[]>,
  service: ReturnType<typeof createService>,
  strapi: any,
  send: ReturnType<typeof vi.fn>
const matches = (row: any, where: any): boolean =>
  Object.entries(where ?? {}).every(([key, value]: any) => {
    if (value && typeof value === "object") {
      if ("$null" in value) return row[key] == null
      if ("$notNull" in value) return row[key] != null
    }

    return row[key] === value
  })
beforeEach(() => {
  vi.stubEnv("EMAIL_LINK_SECRET", "k".repeat(32))
  vi.stubEnv("SMTP_HOST", "smtp.test")
  vi.stubEnv("SMTP_USER", "test")
  vi.stubEnv("SMTP_PASS", "test")
  rows = {
    [SUBSCRIBER]: [
      {
        id: 1,
        documentId: id,
        type: "beta_waitlist",
        state: "active",
        email: "owned@example.test",
        communicationLocale: "en",
        consentedAt: new Date().toISOString(),
      },
    ],
    [INVITATION]: [],
    [NOTIFICATION]: [],
  }
  const query = (uid: string) => ({
    findOne: async ({ where }: any) =>
      rows[uid].find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }: any) =>
      rows[uid].filter((r) => matches(r, where)).toReversed(),
    update: async ({ where, data }: any) =>
      Object.assign(
        rows[uid].find((r) => matches(r, where)),
        data
      ),
    updateMany: async ({ where, data }: any) =>
      rows[uid]
        .filter((r) => matches(r, where))
        .forEach((r) => Object.assign(r, data)),
  })
  send = vi.fn().mockResolvedValue({})
  strapi = {
    db: {
      query,
      dialect: { client: "sqlite" },
      transaction: async (work: any) => work({}),
    },
    documents: (uid: string) => ({
      create: async ({ data }: any) => {
        const row = {
          id: rows[uid].length + 1,
          documentId: String(rows[uid].length + 1).padStart(24, "i"),
          ...data,
        }
        rows[uid].push(row)

        return row
      },
    }),
    service: () => ({
      enqueue: async (data: any) => {
        const row = {
          id: rows[NOTIFICATION].length + 1,
          documentId: `notification-${rows[NOTIFICATION].length}`,
          emailState: "pending",
          ...data,
        }
        rows[NOTIFICATION].push(row)

        return row
      },
    }),
    plugin: () => ({ service: () => ({ send }) }),
  }
  service = createService({ strapi })
})
afterEach(() => vi.unstubAllEnvs())
const issue = () => service.issue(id, "admin-1")
const deliver = () => service.deliver(rows[NOTIFICATION].at(-1), new Date())

describe("individual beta invitations", () => {
  it("queues once and keeps plaintext out of persisted data", async () => {
    expect(await issue()).toEqual({ queued: true })
    expect(await issue()).toEqual({ queued: false })
    expect(rows[INVITATION]).toHaveLength(1)
    const code = openCode(rows[INVITATION][0].tokenCiphertext)
    expect(rows[INVITATION][0].tokenHash).toBe(hashCode(code))
    expect(JSON.stringify(rows)).not.toContain(code)
    expect(rows[NOTIFICATION][0]).toMatchObject({
      kind: "beta_invitation",
      inApp: false,
    })
    expect(send).not.toHaveBeenCalled()
    expect(rows[SUBSCRIBER][0].invitedAt).toBeUndefined()
  })
  it("timestamps sending, clears encrypted credentials and redeems only once", async () => {
    await issue()
    const code = openCode(rows[INVITATION][0].tokenCiphertext)
    expect(await service.redeem(code)).toBeNull()
    expect(await deliver()).toBe("sent")
    expect(rows[SUBSCRIBER][0].invitedAt).toBeTruthy()
    expect(rows[INVITATION][0].tokenCiphertext).toBeNull()
    expect(send.mock.calls[0][0]).toMatchObject({ to: "owned@example.test" })
    const grant = await service.redeem(code)
    expect(grant?.invitationId).toBe(rows[INVITATION][0].documentId)
    expect(await service.redeem(code)).toBeNull()
    expect(await service.validate(grant!.invitationId)).toBe(true)
    await service.revoke(id, "admin-2")
    expect(await service.validate(grant!.invitationId)).toBe(false)
  })
  it("does not record sending when the provider fails", async () => {
    await issue()
    send.mockRejectedValue(new Error("SMTP unavailable"))
    await expect(deliver()).rejects.toThrow("SMTP unavailable")
    expect(rows[INVITATION][0].tokenCiphertext).toBeTruthy()
    expect(rows[SUBSCRIBER][0].invitedAt).toBeUndefined()
  })
  it.each(["unsubscribed", "suppressed"])(
    "never sends or redeems a %s request",
    async (state) => {
      await issue()
      const code = openCode(rows[INVITATION][0].tokenCiphertext)
      rows[SUBSCRIBER][0].state = state
      expect(await deliver()).toBe("skipped")
      expect(send).not.toHaveBeenCalled()
      expect(await service.redeem(code)).toBeNull()
      await expect(issue()).rejects.toThrow("active beta access request")
    }
  )
  it("rechecks revocation and expiry at delivery", async () => {
    await issue()
    await service.revoke(id, "admin-1")
    expect(await deliver()).toBe("skipped")
    expect(send).not.toHaveBeenCalled()
    await issue()
    rows[INVITATION].at(-1).expiresAt = new Date(
      Date.now() - 1000
    ).toISOString()
    expect(await deliver()).toBe("skipped")
  })
  it("resends with a new credential and revokes earlier browser access", async () => {
    await issue()
    const code = openCode(rows[INVITATION][0].tokenCiphertext)
    await deliver()
    const grant = await service.redeem(code)
    rows[INVITATION][0].issuedAt = new Date(Date.now() - 61000).toISOString()
    await service.issue(id, "admin-2", true)
    expect(await service.validate(grant!.invitationId)).toBe(false)
    expect(rows[INVITATION][0].revokedAt).toBeTruthy()
    expect(rows[INVITATION]).toHaveLength(2)
    expect(openCode(rows[INVITATION][1].tokenCiphertext)).not.toBe(code)
  })
  it("allows a new request after consent changes and ends the previous pass", async () => {
    await issue()
    const code = openCode(rows[INVITATION][0].tokenCiphertext)
    await deliver()
    const grant = await service.redeem(code)
    rows[SUBSCRIBER][0].consentedAt = new Date(Date.now() + 1000).toISOString()
    expect(await service.validate(grant!.invitationId)).toBe(false)
    expect(await issue()).toEqual({ queued: true })
    expect(rows[INVITATION]).toHaveLength(2)
    expect(rows[INVITATION][0].revokedAt).toBeTruthy()
    expect(rows[INVITATION][1].consentedAt).toBe(
      rows[SUBSCRIBER][0].consentedAt
    )
  })
  it("retries the same failed credential rather than creating another invitation", async () => {
    await issue()
    const ciphertext = rows[INVITATION][0].tokenCiphertext
    rows[NOTIFICATION][0].emailState = "failed"
    await service.retry(id)
    expect(rows[INVITATION]).toHaveLength(1)
    expect(rows[INVITATION][0].tokenCiphertext).toBe(ciphertext)
    expect(rows[NOTIFICATION][0].emailState).toBe("pending")
  })
  it("rejects newsletters and keeps credentials out of admin history", async () => {
    rows[SUBSCRIBER][0].type = "newsletter"
    await expect(issue()).rejects.toThrow("active beta access request")
    rows[SUBSCRIBER][0].type = "beta_waitlist"
    await issue()
    const history = await service.history(id)
    expect(JSON.stringify(history)).not.toMatch(
      /tokenHash|tokenCiphertext|notificationId/
    )
  })
})

describe("beta invite boundary protection", () => {
  it("requires a bridge secret on redemption and grant validation", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-secret")
    const controller = createController({ strapi })
    const ctx: any = {
      request: {
        headers: {},
        body: { code: "a".repeat(43), invitationId: "i".repeat(24) },
      },
      set: vi.fn(),
    }
    await controller.redeem(ctx)
    expect(ctx.status).toBe(401)
    await controller.validate(ctx)
    expect(ctx.status).toBe(401)
  })
  it("protects every dashboard operation with authenticated admin permissions", () => {
    for (const route of plugin.routes.admin.routes)
      expect(route.config.policies).toEqual([
        "admin::isAuthenticatedAdmin",
        {
          name: "admin::hasPermissions",
          config: { actions: ["plugin::beta-invites.manage"] },
        },
      ])
  })
  it("detects encrypted credential tampering", () => {
    const sealed = Buffer.from(sealCode("a".repeat(43)), "base64url")
    sealed[30] ^= 1
    expect(() => openCode(sealed.toString("base64url"))).toThrow()
  })
})
