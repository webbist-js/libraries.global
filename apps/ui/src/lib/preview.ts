import { ROOT_PAGE_PATH } from "@repo/shared-data"

// No `g` flag: a global regex keeps `lastIndex` between `.test()` calls and
// answers differently on alternate calls.
const VALID_PAGE_URL = new RegExp(
  String.raw`^(${ROOT_PAGE_PATH}[a-zA-Z0-9-%]*)+$`
)

/** A root-relative page path the preview may open. */
export const isValidPreviewUrl = (url: string): boolean =>
  url !== "" && !url.startsWith("//") && VALID_PAGE_URL.test(url)

/**
 * The preview secret from the `X-Preview-Secret` header, else from the
 * `secret` query parameter. The query form stays because Strapi's preview
 * button opens a URL (`config/admin.ts` builds it) and cannot send headers.
 */
export function readPreviewSecret(request: Request): string {
  const header = request.headers.get("x-preview-secret")
  if (header) return header

  return new URL(request.url).searchParams.get("secret") ?? ""
}
