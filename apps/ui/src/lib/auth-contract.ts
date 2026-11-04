import type { SessionAccess } from "@repo/access"
import type { Session as BaseSession, User } from "better-auth"
import type { customSession } from "better-auth/plugins"

/** Public wire contract; importing this never instantiates an auth server. */
export type Session = {
  user: User & SessionAccess & { termsVersion?: string; termsAcceptedAt?: Date }
  session: BaseSession
}

export type AuthContract = {
  options: {
    user: {
      additionalFields: {
        termsVersion: { type: "string"; required: false; input: true }
        termsAcceptedAt: { type: "date"; required: false; input: false }
      }
    }
    plugins: [ReturnType<typeof customSession<Session>>]
  }
}
