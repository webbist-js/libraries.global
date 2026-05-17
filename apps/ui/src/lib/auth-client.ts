import {
  customSessionClient,
  magicLinkClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import type { auth } from "./auth"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [magicLinkClient(), customSessionClient<typeof auth>()],
})
