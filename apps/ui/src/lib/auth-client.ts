import { passkeyClient } from "@better-auth/passkey/client"
import {
  customSessionClient,
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import type { AuthContract } from "./auth-contract"

export const authClient = createAuthClient({
  // Each app host calls its own endpoints, including when an older build URL is set.
  baseURL:
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_APP_URL
      : window.location.origin,
  plugins: [
    passkeyClient(),
    magicLinkClient(),
    customSessionClient<AuthContract>(),
    // Types the terms-acceptance fields that sign-up sends.
    inferAdditionalFields<AuthContract>(),
  ],
})
