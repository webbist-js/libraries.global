import { API_ENDPOINTS } from "@/lib/strapi-api/endpoints"

import { readServerFixture } from "../server-fixtures"

/** The production UID lookup is synchronous and performs no I/O. */
function getStrapiApiPathByUId(uid: keyof typeof API_ENDPOINTS): string {
  const path = API_ENDPOINTS[uid]
  if (path) return path
  throw new Error(
    `Endpoint for UID "${uid}" not found. Extend API_ENDPOINTS in lib/api/client.ts.`
  )
}

const fixtureClient = (name: string) =>
  new Proxy(
    { getStrapiApiPathByUId },
    {
      get(target, method) {
        if (method === "getStrapiApiPathByUId")
          return target.getStrapiApiPathByUId
        // Inspection and Promise assimilation must not trigger a CMS request.
        if (typeof method !== "string" || method === "then") return

        return (...args: unknown[]) =>
          readServerFixture(`cms.${name}.${method}`, args)
      },
    }
  )

export const PublicStrapiClient = fixtureClient("public")
export const PrivateStrapiClient = fixtureClient("private")
