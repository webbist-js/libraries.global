import "server-only"

import { headers } from "next/headers"
import { cache } from "react"

import { getSessionSSR } from "./auth-server"

/** One request snapshot keeps public persona content and its layout scope aligned. */
export const getContributionSession = cache(async () =>
  getSessionSSR(await headers())
)
