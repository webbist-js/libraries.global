import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Aurora CTA button classNames ──────────────────────────────────────────────

const _auroraCta =
  "inline-flex items-center gap-2 rounded-2xl border border-[rgba(127,223,255,.35)] bg-[rgba(127,223,255,.1)] text-sm font-semibold text-[#7fdfff] transition-colors hover:bg-[rgba(127,223,255,.18)]"

/** Aurora CTA — small padding (editorial inline CTAs) */
export const auroraCtaSm = cn(_auroraCta, "px-5 py-2.5")
/** Aurora CTA — medium padding (CTA banners) */
export const auroraCtaMd = cn(_auroraCta, "px-7 py-3")
/** Aurora CTA — large padding (journey fallback CTAs) */
export const auroraCtaLg = cn(_auroraCta, "px-8 py-3.5")
