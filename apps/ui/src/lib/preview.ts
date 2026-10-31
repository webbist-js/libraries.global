import { ROOT_PAGE_PATH } from "@repo/shared-data"

// No `g` flag: a global regex keeps `lastIndex` between `.test()` calls and
// answers differently on alternate calls.
const VALID_PAGE_URL = new RegExp(
  String.raw`^(${ROOT_PAGE_PATH}[a-zA-Z0-9-%]*)+$`
)

/** A root-relative page path the preview may open. */
export const isValidPreviewUrl = (url: string): boolean =>
  url !== "" && !url.startsWith("//") && VALID_PAGE_URL.test(url)

/** Header authentication is retained for trusted server callers. Browser
 * previews use a scoped one-minute ticket, never a shared secret in a URL. */
export function readPreviewSecret(request: Request): string {
  return request.headers.get("x-preview-secret") ?? ""
}
