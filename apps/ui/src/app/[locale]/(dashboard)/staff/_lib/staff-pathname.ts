import "server-only"
import { headers } from "next/headers"

/**
 * The request's path for the access page's sign-in callback, so a signed-out
 * deep link (`/staff/{slug}/notices`) comes back to the same tab. It needs the
 * proxy to forward the path as `x-pathname`; without that header the
 * callback falls back to the staff index. Read the same way in the
 * layout and in every page, so the cached loader is called with one set of
 * arguments per request.
 */
export async function staffPathname(): Promise<string | undefined> {
  const value = (await headers()).get("x-pathname")

  return value && value.startsWith("/") ? value : undefined
}
