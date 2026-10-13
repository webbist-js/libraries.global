import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { magicLink } from "better-auth/plugins/magic-link"
import { describe, expect, it } from "vitest"

function fixture() {
  const data: Record<string, Record<string, unknown>[]> = {
    user: [],
    account: [],
    session: [],
    verification: [],
  }
  let token = ""
  const auth = betterAuth({
    baseURL: "https://libraries.example",
    secret: "isolated-auth-regression-fixture-only-2026",
    database: memoryAdapter(data),
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: { sendVerificationEmail: async () => {} },
    plugins: [
      magicLink({
        disableSignUp: true,
        sendMagicLink: async (message) => {
          token = message.token
        },
      }),
    ],
  })

  return { auth, data, getToken: () => token }
}

describe("email ownership proof with the real auth library", () => {
  it("removes a password and old session planted before mailbox ownership was proved", async () => {
    const { auth, data, getToken } = fixture()
    const body = {
      name: "Owner",
      email: "owner@example.test",
      password: "UnprovenPassword123!",
    }
    const created = await auth.api.signUpEmail({
      body,
      headers: new Headers({ Origin: "https://libraries.example" }),
    })
    const context = await auth.$context
    const oldSession = await context.internalAdapter.createSession(
      created.user.id
    )
    await expect(
      auth.api.signInEmail({
        body,
        headers: new Headers({ Origin: "https://libraries.example" }),
      })
    ).rejects.toBeDefined()

    await auth.api.signInMagicLink({
      body: { email: body.email },
      headers: new Headers({ Origin: "https://libraries.example" }),
    })
    const verified = await auth.api.magicLinkVerify({
      query: { token: getToken(), callbackURL: "/" },
      headers: new Headers({ Origin: "https://libraries.example" }),
      asResponse: true,
    })
    expect(verified.status).toBe(302)
    expect(data.user?.[0]?.emailVerified).toBe(true)
    expect(
      data.account?.filter((account) => account.providerId === "credential")
    ).toHaveLength(0)
    expect(data.session?.some((session) => session.id === oldSession.id)).toBe(
      false
    )
    await expect(
      auth.api.signInEmail({
        body,
        headers: new Headers({ Origin: "https://libraries.example" }),
      })
    ).rejects.toBeDefined()
  })

  it("preserves a password whose mailbox ownership was already verified", async () => {
    const { auth, data, getToken } = fixture()
    const body = {
      name: "Owner",
      email: "verified@example.test",
      password: "ProvenPassword123!",
    }
    const created = await auth.api.signUpEmail({
      body,
      headers: new Headers({ Origin: "https://libraries.example" }),
    })
    const context = await auth.$context
    await context.internalAdapter.updateUser(created.user.id, {
      emailVerified: true,
    })

    await auth.api.signInMagicLink({
      body: { email: body.email },
      headers: new Headers({ Origin: "https://libraries.example" }),
    })
    const verified = await auth.api.magicLinkVerify({
      query: { token: getToken(), callbackURL: "/" },
      headers: new Headers({ Origin: "https://libraries.example" }),
      asResponse: true,
    })
    expect(verified.status).toBe(302)
    expect(
      data.account?.filter((account) => account.providerId === "credential")
    ).toHaveLength(1)
    const signedIn = await auth.api.signInEmail({
      body,
      headers: new Headers({ Origin: "https://libraries.example" }),
    })
    expect(signedIn.user.id).toBe(created.user.id)
  })
})
