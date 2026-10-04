// apps/ui/src/app/[locale]/auth/_components/auth-error.ts

/**
 * The parts of a Better Auth client error. It rejects with a plain
 * { status, code, message } object, not an Error, so `instanceof Error`
 * checks never match it.
 */
export function authErrorParts(error: unknown): {
  status?: number
  code?: string
  message?: string
} {
  return (error ?? {}) as { status?: number; code?: string; message?: string }
}
