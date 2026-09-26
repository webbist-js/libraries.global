import { type NextRequest, NextResponse } from "next/server"

import { getEnvVar } from "@/lib/env-vars"
import { safeEqual } from "@/lib/safe-equal"

const UNAUTHORIZED_RESPONSE = (message: string) =>
  new NextResponse(message, {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
  })

/**
 * Requires HTTP Basic Authentication when BASIC_AUTH_ENABLED is set.
 * Returns a 401 response if credentials are missing or invalid, null otherwise.
 */
export const basicAuth = (req: NextRequest): NextResponse | null => {
  if (!getEnvVar("BASIC_AUTH_ENABLED")) {
    return null
  }

  const authHeader = req.headers.get("authorization")

  if (!authHeader?.startsWith("Basic ")) {
    return UNAUTHORIZED_RESPONSE("Authentication required")
  }

  try {
    const credentials = atob(authHeader.substring(6))
    // Split on the first colon only — passwords may contain ":".
    const separator = credentials.indexOf(":")
    const username =
      separator === -1 ? credentials : credentials.slice(0, separator)
    const password = separator === -1 ? "" : credentials.slice(separator + 1)
    const expectedUser = getEnvVar("BASIC_AUTH_USERNAME") ?? ""
    const expectedPassword = getEnvVar("BASIC_AUTH_PASSWORD") ?? ""

    // Evaluate both comparisons so timing doesn't reveal which one failed.
    const userOk = safeEqual(username, expectedUser)
    const passwordOk = safeEqual(password, expectedPassword)
    if (!expectedUser || !expectedPassword || !userOk || !passwordOk) {
      return UNAUTHORIZED_RESPONSE("Invalid credentials")
    }
  } catch {
    return UNAUTHORIZED_RESPONSE("Invalid credentials format")
  }

  return null
}
