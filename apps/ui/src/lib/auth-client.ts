import { passkeyClient } from "@better-auth/passkey/client"
import {
  customSessionClient,
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import type { auth } from "./auth"

export const authClient = createAuthClient({
  // Better Auth uses the browser's current origin when no public URL is built in.
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    passkeyClient(),
    magicLinkClient(),
    customSessionClient<typeof auth>(),
    // Types the terms-acceptance fields that sign-up sends.
    inferAdditionalFields<typeof auth>(),
  ],
})
