import { APIError } from "better-auth/api"

/** Discord can return an account without a verified mailbox; never promote it. */
export function verifiedDiscordProfile(profile: {
  email?: string | null
  verified?: boolean
}) {
  if (
    profile.verified !== true ||
    typeof profile.email !== "string" ||
    !profile.email.trim()
  )
    throw new APIError("BAD_REQUEST", {
      message: "Verify your Discord email address before signing in.",
    })

  return {}
}
