import { NextResponse } from "next/server"

import { getEnvVar } from "@/lib/env-vars"
import {
  createStrapiAuthHeader,
  isStrapiEndpointAllowed,
} from "@/lib/strapi-api/request-auth"

/**
 * This route handler acts as a public proxy for frontend requests with two primary goals:
 * - Hide the authenticated API token from the client (for both SSR and client-side components).
 * - Hide the backend URL, so it cannot be accessed directly.
 *
 * It is a public proxy that injects the Strapi API token (https://docs.strapi.io/cms/features/api-tokens) into the request.
 *
 * Since the STRAPI_REST_READONLY_API_KEY is injected into every GET request and Strapi does not block findOne and findMany
 * operations for any content type, this proxy checks if the requested content type is allowed to be fetched.
 */
const FORWARD_HEADERS = ["accept", "accept-language", "content-type"]

function pickForwardHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of FORWARD_HEADERS) {
    const value = headers.get(name)
    if (value) out[name] = value
  }

  return out
}

async function handler(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params

  const path = Array.isArray(slug) ? slug.join("/") : slug

  const isAccessible = isStrapiEndpointAllowed(path, request.method)
  if (!isAccessible) {
    return NextResponse.json(
      {
        error: {
          message: `Path '${path}' is not accessible`,
          name: "Forbidden",
        },
      },
      { status: 403 }
    )
  }

  const strapiUrl = getEnvVar("STRAPI_URL", true)
  const incoming = new URL(request.url)
  const target = new URL(`${strapiUrl!.replace(/\/$/, "")}/${path}`)
  // Final guard: the resolved path must still be the allowlisted one.
  const expectedSuffix = new URL(`http://proxy.invalid/${path}`).pathname
  if (!target.pathname.endsWith(expectedSuffix)) {
    return NextResponse.json(
      { error: { message: "Forbidden", name: "Forbidden" } },
      { status: 403 }
    )
  }
  incoming.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value)
  })
  // The service token can read drafts; this proxy only ever serves published.
  if (target.searchParams.has("status")) {
    target.searchParams.set("status", "published")
  }
  const url = target.toString()
  const isReadOnly = request.method === "GET" || request.method === "HEAD"

  const clonedRequest = request.clone()
  // Extract the body explicitly from the cloned request
  let body: string | Blob | undefined
  if (!isReadOnly) {
    const contentType = clonedRequest.headers.get("content-type")

    // eslint-disable-next-line unicorn/prefer-ternary
    if (contentType?.includes("multipart/form-data")) {
      // File upload - preserve FormData as blob
      body = await clonedRequest.blob()
    } else {
      // Regular API call - use text for JSON
      body = await clonedRequest.text()
    }
  }

  const authHeader = await createStrapiAuthHeader({
    isReadOnly,
    isPrivate: false,
  })

  const response = await fetch(url, {
    headers: {
      // Forward only content-negotiation headers. Passing every client header
      // through would let callers inject service headers (x-service-secret,
      // x-ba-user-id) or cookies into a request that carries our API token.
      ...pickForwardHeaders(clonedRequest.headers),
      ...authHeader,
    },
    body,
    // this needs to be explicitly stated, because it is defaulted to GET
    method: request.method,
  })

  // Remove encoding headers, because the body is no longer compressed and the browser/client will choke on it.
  // (Built-in fetch in Node.js decompresses the body if the response has Content-Encoding: gzip
  // and gives the decompressed stream.)
  const headers = new Headers(response.headers)
  headers.delete("content-encoding")
  headers.delete("content-length")

  return new NextResponse(response.body, {
    status: response.status,
    headers,
  })
}

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as POST,
  handler as PUT,
}
