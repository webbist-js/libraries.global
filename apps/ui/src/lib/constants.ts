export const FALLBACK_IMAGE_PATH = "/images/broken-image.png"
export const PASSWORD_MIN_LENGTH = 10 // enforced server-side by Better Auth (lib/auth.ts)
export const PASSWORD_MAX_LENGTH = 128 // Better Auth's maxPasswordLength
export const KOFI_URL = "https://ko-fi.com/libraries"

/**
 * Official brand name (matches the libraries.global domain). Used in page
 * titles, og:site_name, JSON-LD, emails and the footer. The header wordmark
 * sets the same words as "Libraries *Global*".
 */
export const SITE_NAME = "Libraries Global"

/** General enquiries (see SECURITY.md and CODE_OF_CONDUCT.md). */
export const CONTACT_EMAIL = "info@libraries.global"
