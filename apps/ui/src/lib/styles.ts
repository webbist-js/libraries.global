import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Primary CTA button classNames (v2 indigo pills) ──────────────────────────

const _primaryCta =
  "inline-flex items-center gap-2 rounded-full bg-(--t-accent-primary) text-sm font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"

/** Primary CTA — small padding (editorial inline CTAs) */
export const primaryCtaSm = cn(_primaryCta, "px-5 py-2.5")
/** Primary CTA — medium padding (CTA banners) */
export const primaryCtaMd = cn(_primaryCta, "px-7 py-3")
/** Primary CTA — large padding (journey fallback CTAs) */
export const primaryCtaLg = cn(_primaryCta, "px-8 py-3.5")
