import { createHmac, timingSafeEqual } from "node:crypto"

const COOKIE = "lg_signup_proof"
const TTL = 3600

export type VerificationContext = {
  secret: string
  adapter: {
    deleteMany: (input: {
      model: string
      where: { field: string; value: string }[]
    }) => Promise<unknown>
  }
}
const signature = (value: string, secret: string) =>
  createHmac("sha256", secret).update(`mailbox-signup:${value}`).digest("hex")

function browserOwnsSignup(
  userId: string,
  request: Request | undefined,
  secret: string
) {
  const cookie = request?.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1)
  if (!cookie) return false
  try {
    const [payload, signed] = decodeURIComponent(cookie).split(".")
    if (!payload || !signed || !/^[a-f0-9]{64}$/.test(signed)) return false
    if (
      !timingSafeEqual(
        Buffer.from(signed, "hex"),
        Buffer.from(signature(payload, secret), "hex")
      )
    )
      return false
    const proof = JSON.parse(Buffer.from(payload, "base64url").toString())

    return (
      proof.userId === userId &&
      proof.expires > Date.now() &&
      proof.expires <= Date.now() + TTL * 1000
    )
  } catch {
    return false
  }
}

/** Shared by the production auth config and the real-library two-browser regression. */
export function emailOwnershipProtection(
  getContext: () => Promise<VerificationContext>
) {
  return {
    async beforeEmailVerification(
      user: { id: string; emailVerified: boolean },
      request?: Request
    ) {
      if (user.emailVerified) return
      const context = await getContext()
      // Only the browser that registered this password may retain it. Mailbox
      // proof from another browser must not activate an attacker's password.
      if (!browserOwnsSignup(user.id, request, context.secret))
        await context.adapter.deleteMany({
          model: "account",
          where: [
            { field: "userId", value: user.id },
            { field: "providerId", value: "credential" },
          ],
        })
      await context.adapter.deleteMany({
        model: "session",
        where: [{ field: "userId", value: user.id }],
      })
    },
  }
}

export function recordSignupBrowser(
  context: {
    path: string
    context: { secret: string; returned?: unknown }
    setCookie: (
      name: string,
      value: string,
      options: {
        path: string
        maxAge: number
        httpOnly: boolean
        sameSite: "lax"
        secure: boolean
      }
    ) => void
  },
  secure: boolean
) {
  const options = {
    path: "/api/auth",
    maxAge: TTL,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
  }
  if (context.path === "/verify-email") {
    context.setCookie(COOKIE, "", { ...options, maxAge: 0 })

    return
  }
  if (context.path !== "/sign-up/email") return
  const result = context.context.returned as
    | { user?: { id?: string } }
    | undefined
  if (typeof result?.user?.id !== "string") return
  const payload = Buffer.from(
    JSON.stringify({ userId: result.user.id, expires: Date.now() + TTL * 1000 })
  ).toString("base64url")
  context.setCookie(
    COOKIE,
    `${payload}.${signature(payload, context.context.secret)}`,
    options
  )
}
