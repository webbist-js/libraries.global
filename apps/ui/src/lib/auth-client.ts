import { magicLinkClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

const strapiUrl = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://127.0.0.1:1337"

export const authClient = createAuthClient({
  baseURL: `${strapiUrl}/api/better-auth`,
  plugins: [magicLinkClient()],
})
