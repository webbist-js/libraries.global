import { getEnvVar } from "@/lib/env-vars"

/**
 * Logs non-blocking errors only if SHOW_NON_BLOCKING_ERRORS environment variable is set to true.
 * This prevents in-memory storage from filling up during builds when errors are logged but execution continues.
 * @param args - Arguments to pass to console.error (same signature as console.error)
 */
export const logNonBlockingError = (...args: unknown[]) => {
  const showErrors = getEnvVar("SHOW_NON_BLOCKING_ERRORS")
  if (!showErrors) return
  // Serialize each arg so Node/Next's browser overlay shows useful text rather than `{}`
  const formatted = args.map((a) =>
    a instanceof Error
      ? `${a.name}: ${a.message}`
      : typeof a === "object" && a !== null
        ? JSON.stringify(a)
        : String(a ?? "")
  )
  console.error(...formatted)
}
