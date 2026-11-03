/** Explicit local acceptance against the existing database; no extra stack/schema. */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { parseEnv } from "node:util"

import { TERMS_VERSION } from "@repo/shared-data/auth-policy"

import { testAuthenticator } from "./auth-test-authenticator.mjs"

const { compileStrapi, createStrapi } = createRequire(import.meta.url)(
  "@strapi/strapi"
)
async function main() {
  process.loadEnvFile(".env")
  // Exercise mobile proof signing even when the local mobile app is disabled.
  // This ephemeral fixture key is never persisted or used by the dev server.
  process.env.MOBILE_LIVE_STEPUP_SECRET ??= randomUUID()
  const database = new URL(process.env.APPLICATION_DATABASE_URL)
  const site = new URL(process.env.APP_PUBLIC_URL)
  assert.ok(
    ["localhost", "127.0.0.1"].includes(database.hostname) &&
      database.port === "5433",
    "Existing local database required"
  )
  assert.ok(
    ["localhost", "127.0.0.1"].includes(site.hostname),
    "Local UI required"
  )
  process.env.CRON_ENABLED = "false"
  process.env.INTERNAL_NOTIFICATIONS_ENABLED = "false"
  process.env.STRAPI_TELEMETRY_DISABLED = "1"
  const options = {
    appDir: process.cwd(),
    distDir: path.resolve("dist"),
    autoReload: false,
    serveAdminPanel: false,
  }
  await compileStrapi(options)
  const app = await createStrapi(options).load()
  const messages = []
  app.plugin("email").service("email").send = async (message) => {
    messages.push(message)

    return {}
  }
  await app.start()
  const auth = app.plugin("better-auth").service("auth-service").getAuth()
  const ctx = await auth.$context
  const accounts = []
  const cookies = new Map()
  const secret = process.env.STRAPI_BRIDGE_SECRET
  async function request(
    path,
    body,
    upstream = false,
    method,
    extraHeaders = {}
  ) {
    const response = await fetch(
      new URL(path, upstream ? "http://127.0.0.1:1337" : site),
      {
        method: method ?? (body === undefined ? "GET" : "POST"),
        headers: {
          origin: site.origin,
          cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(upstream ? { "x-service-secret": secret } : {}),
          ...extraHeaders,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: "manual",
        signal: AbortSignal.timeout(60_000),
      }
    )
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0]
      const i = pair.indexOf("=")
      cookies.set(pair.slice(0, i), pair.slice(i + 1))
    }

    return response
  }
  try {
    const denied = await fetch("http://127.0.0.1:1337/api/auth/get-session")
    assert.equal(
      denied.status,
      401,
      "Direct auth must reject missing transport secret"
    )
    const publicRead = await fetch(
      "http://127.0.0.1:1337/api/countries?pagination[pageSize]=1",
      { headers: { "x-service-secret": secret } }
    )
    assert.equal(publicRead.status, 200, "Reviewed public catalogue read")
    const readToken = parseEnv(
      readFileSync("../ui/.env.local", "utf8")
    ).STRAPI_REST_READONLY_API_KEY
    assert.ok(readToken, "Existing local read-only API token required")
    for (const [token, expected] of [
      [readToken, 200],
      ["invalid-acceptance-token", 401],
    ]) {
      const response = await fetch(
        "http://127.0.0.1:1337/api/countries?pagination[pageSize]=1",
        {
          headers: {
            "x-service-secret": secret,
            authorization: `Bearer ${token}`,
          },
        }
      )
      assert.equal(
        response.status,
        expected,
        "API token authorization must not fall back to anonymous access"
      )
    }
    assert.equal(
      (
        await fetch("http://127.0.0.1:1337/api/countries", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-service-secret": secret,
            authorization: `Bearer ${readToken}`,
          },
          body: '{"data":{"name":"forbidden"}}',
        })
      ).status,
      403,
      "Read-only API token cannot write"
    )
    assert.equal(
      (
        await fetch("http://127.0.0.1:1337/api/countries", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-service-secret": secret,
          },
          body: '{"data":{"name":"forbidden"}}',
        })
      ).status,
      401,
      "Anonymous writes denied"
    )
    assert.equal(
      (
        await fetch("http://127.0.0.1:1337/api/user-profiles", {
          headers: { "x-service-secret": secret },
        })
      ).status,
      404,
      "Private profile collection has no public CRUD route"
    )
    console.log("PASS transport boundary and anonymous content permissions")
    const email = `auth-acceptance-${randomUUID()}@example.invalid`
    let password = `Acceptance-${randomUUID()}!`
    let response = await request("/api/auth/sign-up/email", {
      name: "Acceptance Fixture",
      email,
      password,
      termsVersion: TERMS_VERSION,
    })
    assert.equal(response.status, 200, `Signup status ${response.status}`)
    const signup = await response.json()
    accounts.push(signup.user.id)
    assert.match(signup.user.id, /^\d+$/)
    assert.equal(
      await app.db
        .query("api::user-profile.user-profile")
        .count({ where: { baUserId: signup.user.id } }),
      1
    )
    response = await request("/api/auth/sign-in/email", { email, password })
    assert.equal(response.status, 403, "Unverified password rejected")
    const message = messages.find((entry) => entry.to === email)
    assert.ok(message, "Verification delivery captured locally")
    const match = String(message.html).match(
      /https?:[^"\s<>]+\/api\/auth\/verify-email[^"\s<>]+/
    )
    assert.ok(match, "Verification URL present")
    const verification = new URL(match[0].replaceAll("&amp;", "&"))
    response = await request(verification.pathname + verification.search)
    assert.ok(
      [200, 302].includes(response.status),
      `Verification status ${response.status}`
    )
    response = await request("/api/auth/sign-in/email", { email, password })
    assert.equal(response.status, 200, "Verified password signs in")
    response = await request("/api/auth/get-session")
    const session = await response.json()
    assert.equal(session.user.id, signup.user.id)
    assert.equal(session.user.contributorRole, "reader")
    assert.equal(
      await app.db
        .query("api::user-profile.user-profile")
        .count({ where: { baUserId: signup.user.id } }),
      1
    )
    response = await request(
      "/api/auth-internal/verify-password",
      { password },
      true
    )
    assert.equal(response.status, 200, "Server-only password confirmation")
    console.log(
      "PASS signup, verification, password login, profile provisioning and session projection"
    )
    response = await request("/api/account/profile", undefined, true)
    assert.equal(
      response.status,
      200,
      "Native session policy permits the cookie owner"
    )
    const owner = await response.json()
    assert.equal(owner.data.baUserId, undefined)
    assert.equal(owner.data.authUser, undefined)
    assert.equal(owner.data.firstName, "Acceptance")

    response = await request("/api/profile/me")
    assert.equal(
      response.status,
      200,
      "Next owner-profile route uses native cookie policy"
    )
    response = await request("/api/profile/me/export")
    assert.equal(response.status, 200, "Account export remains available")
    assert.match(response.headers.get("content-disposition"), /attachment/)
    const grant = await app.documents("api::role-grant.role-grant").create({
      data: {
        baUserId: signup.user.id,
        role: "moderator",
        queue: "knowledge",
        scopeLocale: "fr",
        source: "admin",
        reason: "Synthetic acceptance fixture",
      },
    })
    let projected = await (await request("/api/auth/get-session")).json()
    assert.equal(projected.user.contributorRole, "moderator")
    assert.ok(
      projected.user.moderationScopes.some(
        (scope) => scope.queue === "knowledge" && scope.locale === "fr"
      )
    )
    await app
      .documents("api::role-grant.role-grant")
      .delete({ documentId: grant.documentId })
    projected = await (await request("/api/auth/get-session")).json()
    assert.equal(
      projected.user.contributorRole,
      "reader",
      "Revocation is visible on the next session read"
    )
    console.log(
      "PASS owner profile/export and immediate scoped-role grant/revocation"
    )

    const mailStart = messages.length
    response = await request("/api/auth/sign-in/magic-link", {
      email,
      callbackURL: "/profile",
    })
    assert.equal(response.status, 200)
    const magicMessage = messages
      .slice(mailStart)
      .find((entry) => entry.to === email)
    const magicMatch = String(magicMessage?.html).match(
      /https?:[^"\s<>]+\/api\/auth\/magic-link\/verify[^"\s<>]+/
    )
    assert.ok(magicMatch, "Magic link captured locally")
    const magicUrl = new URL(magicMatch[0].replaceAll("&amp;", "&"))
    response = await request(magicUrl.pathname + magicUrl.search)
    assert.ok([200, 302].includes(response.status))
    response = await request(magicUrl.pathname + magicUrl.search)
    assert.ok(
      response.status >= 400 ||
        response.headers.get("location")?.includes("error"),
      "Magic links cannot be replayed"
    )
    const resetStart = messages.length
    response = await request("/api/auth/request-password-reset", {
      email,
      redirectTo: "/auth/reset-password",
    })
    assert.equal(response.status, 200)
    const resetMessage = messages
      .slice(resetStart)
      .find((entry) => entry.to === email)
    const resetMatch = String(resetMessage?.html).match(
      /https?:[^"\s<>]+\/auth\/reset-password[^"\s<>]+/
    )
    assert.ok(resetMatch, "Password reset captured locally")
    const resetUrl = new URL(resetMatch[0].replaceAll("&amp;", "&"))
    const newPassword = `Acceptance-reset-${randomUUID()}!`
    response = await request("/api/auth/reset-password", {
      token: resetUrl.searchParams.get("token"),
      newPassword,
    })
    assert.equal(response.status, 200)
    assert.equal(
      await (await request("/api/auth/get-session")).json(),
      null,
      "Password reset revokes existing sessions"
    )
    response = await request("/api/auth/sign-in/email", { email, password })
    assert.equal(response.status, 401, "Old password is rejected")
    password = newPassword
    response = await request("/api/auth/sign-in/email", { email, password })
    assert.equal(response.status, 200)
    console.log(
      "PASS magic-link single use and password reset with session revocation"
    )

    // The real PostgreSQL adapter must preserve every predicate and permit one consumer.
    const identifier = `acceptance-${randomUUID()}`
    const verificationRow = await ctx.adapter.create({
      model: "verification",
      data: {
        identifier,
        value: "single-use",
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    const where = [
      { field: "id", value: verificationRow.id },
      { field: "value", value: "single-use" },
    ]
    const wins = await Promise.all([
      ctx.adapter.deleteMany({ model: "verification", where }),
      ctx.adapter.deleteMany({ model: "verification", where }),
    ])
    assert.deepEqual(wins.sort(), [0, 1])
    const counter = await ctx.adapter.create({
      model: "rateLimit",
      data: { key: identifier, count: 1, lastRequest: Date.now() },
    })
    const updates = await Promise.all(
      [2, 3].map((count) =>
        ctx.adapter.updateMany({
          model: "rateLimit",
          where: [
            { field: "id", value: counter.id },
            { field: "count", value: 1 },
          ],
          update: { count },
        })
      )
    )
    assert.deepEqual(updates.sort(), [0, 1])
    await ctx.adapter.deleteMany({
      model: "rateLimit",
      where: [{ field: "id", value: counter.id }],
    })
    console.log(
      "PASS real PostgreSQL single-consumer token and conditional counter mutations"
    )
    response = await request("/api/auth/sign-out", {})
    assert.equal(response.status, 200)
    assert.equal(await (await request("/api/auth/get-session")).json(), null)
    console.log("PASS logout and cookie removal")
    response = await request("/api/auth/sign-in/email", { email, password })
    assert.equal(response.status, 200)
    const device = testAuthenticator(site.origin)
    const registerOptions = await (
      await request("/api/auth/passkey/generate-register-options")
    ).json()
    response = await request("/api/auth/passkey/verify-registration", {
      name: "Synthetic acceptance device",
      response: device.registration(registerOptions, 2147483648),
    })
    assert.equal(
      response.status,
      200,
      "WebAuthn registration accepts an unsigned 32-bit counter"
    )
    await request("/api/auth/sign-out", {})
    let options = await (
      await request("/api/auth/passkey/generate-authenticate-options")
    ).json()
    response = await request("/api/auth/passkey/verify-authentication", {
      response: device.authentication(
        options,
        2147483649,
        "https://wrong-origin.invalid"
      ),
    })
    assert.equal(response.status, 400, "Passkey rejects a different origin")
    options = await (
      await request("/api/auth/passkey/generate-authenticate-options")
    ).json()
    const assertion = { response: device.authentication(options, 2147483649) }
    response = await request(
      "/api/auth/passkey/verify-authentication",
      assertion
    )
    assert.equal(response.status, 200, "Registered passkey creates a session")
    assert.equal((await response.json()).user.id, signup.user.id)
    response = await request(
      "/api/auth/passkey/verify-authentication",
      assertion
    )
    assert.equal(response.status, 400, "Passkey challenge cannot be replayed")
    options = await (
      await request("/api/auth/passkey/generate-authenticate-options")
    ).json()
    response = await request(
      "/api/auth/passkey/verify-authentication",
      {
        response: device.authentication(options, 2147483650),
      },
      false,
      undefined,
      { "x-live-confirm": "true" }
    )
    assert.equal(
      response.status,
      200,
      "Existing mobile live-confirmation hook accepts the same passkey owner"
    )
    assert.ok(
      cookies.get("lg_live"),
      "Live confirmation sets its signed proof cookie"
    )
    console.log(
      "PASS passkey registration, login, origin/replay protection and mobile step-up"
    )
    response = await request("/api/profile/me", undefined, false, "DELETE")
    assert.equal(
      response.status,
      200,
      "Account deletion coordinates billing and domain erasure"
    )
    assert.equal(
      await app.db
        .query("plugin::better-auth.user")
        .count({ where: { id: Number(signup.user.id) } }),
      0
    )
    assert.equal(
      await app.db
        .query("plugin::better-auth.passkey")
        .count({ where: { userId: Number(signup.user.id) } }),
      0
    )
    const erased = await app.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId: signup.user.id } })
    assert.equal(
      erased,
      null,
      "No active profile remains attached to erased identity"
    )
    accounts.splice(accounts.indexOf(signup.user.id), 1)
    assert.equal(
      (await request("/api/profile/me")).status,
      401,
      "Signed-out server gateway fails closed without throwing"
    )
    console.log("PASS account deletion and passkey cascade")
  } finally {
    for (const id of accounts) {
      // Synthetic fixtures only; normal account erasure gets a separate acceptance check.
      await app.db
        .query("api::user-profile.user-profile")
        .deleteMany({ where: { baUserId: id } })
      await ctx.internalAdapter.deleteUser(id)
    }
    await app.destroy()
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.stack : "Acceptance failed")
  process.exitCode = 1
})
