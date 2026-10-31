/* eslint-disable sonarjs/no-hardcoded-passwords -- Deliberate disposable planted-password inputs for the verification exploit regression. */
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { createAuthMiddleware } from "better-auth/api"
import { expect, it } from "vitest"

import {
  emailOwnershipProtection,
  recordSignupBrowser,
  type VerificationContext,
} from "../email-ownership-proof"

function fixture() {
  const data: Record<string, Record<string, unknown>[]> = {
    user: [],
    account: [],
    session: [],
    verification: [],
  }
  let verificationUrl = ""
  let sent = 0
  const context = async (): Promise<VerificationContext> => auth.$context
  const auth = betterAuth({
    baseURL: "https://libraries.example",
    secret: "isolated-production-hook-regression-fixture-2026",
    database: memoryAdapter(data),
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: {
      ...emailOwnershipProtection(context),
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ url }) => {
        verificationUrl = url
        sent++
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        recordSignupBrowser(ctx, true)
      }),
    },
  })
  const request = (path: string, body?: unknown, cookie?: string) =>
    auth.handler(
      new Request(`https://libraries.example/api/auth/${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          Origin: "https://libraries.example",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    )

  return { auth, data, request, url: () => verificationUrl, sent: () => sent }
}

it.each([false, true])(
  "email verification from the signup browser (%s) is the only case that retains its password",
  async (sameBrowser) => {
    const test = fixture()
    const signup = await test.request("sign-up/email", {
      name: "Owner",
      email: "owner@example.test",
      password: "MailboxProofPassword123!",
    })
    expect(signup.ok).toBe(true)
    const cookie = signup.headers
      .getSetCookie()
      .find((value) => value.startsWith("lg_signup_proof="))
      ?.split(";")[0]
    expect(cookie).toBeTruthy()
    const userId = test.data.user![0]!.id as string
    const context = await test.auth.$context
    const old = await context.internalAdapter.createSession(userId)
    const verified = await test.auth.handler(
      new Request(test.url(), {
        headers: sameBrowser ? { Cookie: cookie! } : {},
      })
    )
    expect(verified.status).toBe(302)
    expect(test.data.user![0]?.emailVerified).toBe(true)
    expect(
      test.data.account!.filter((row) => row.providerId === "credential")
    ).toHaveLength(sameBrowser ? 1 : 0)
    expect(test.data.session!.some((row) => row.id === old.id)).toBe(false)
  }
)

it("does not retain the planted password when its proof cookie was forged", async () => {
  const test = fixture()
  await test.request("sign-up/email", {
    name: "Owner",
    email: "owner@example.test",
    password: "MailboxProofPassword123!",
  })
  await test.auth.handler(
    new Request(test.url(), {
      headers: { Cookie: "lg_signup_proof=forged.signature" },
    })
  )
  expect(test.data.account).toHaveLength(0)
})

it("does not resend unsolicited verification mail on failed password sign-in", async () => {
  const test = fixture()
  const body = {
    name: "Owner",
    email: "owner@example.test",
    password: "MailboxProofPassword123!",
  }
  await test.request("sign-up/email", body)
  expect(test.sent()).toBe(1)
  await test.request("sign-in/email", body)
  expect(test.sent()).toBe(1)
})
