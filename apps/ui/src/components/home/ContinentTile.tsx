import type { Locale } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

export function ContinentTile({
  continent,
  locale,
}: {
  readonly continent: HomepageContinentSummary
  readonly locale: Locale
}) {
  const formattedCount = new Intl.NumberFormat(locale).format(
    continent.libraryCount
  )

  const continentHref =
    continent.slug ??
    continent.code?.trim().toLowerCase() ??
    continent.name?.trim().toLowerCase().replaceAll(/\s+/g, "-")

  return (
    <GlobalLink
      href={continentHref ? `/${continentHref}` : undefined}
      fallbackAs="div"
      aria-label={
        continent.name ? `Browse libraries in ${continent.name}` : undefined
      }
      className="group relative flex h-[200px] flex-col overflow-hidden rounded-2xl p-5 transition-all duration-500 hover:border-white/[0.14] hover:bg-[#0a1020] focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none sm:h-[220px] lg:h-[260px]"
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      {/* Subtle hover glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(84,171,255,0.06),transparent_65%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Top row: continent code + count */}
      <div className="relative flex items-start justify-between">
        <span className="font-mono text-[10px] tracking-[0.22em] text-white/30 uppercase">
          {continent.code ?? "—"}
        </span>
        <span className="font-mono text-[10px] tracking-[0.14em] text-white/22 tabular-nums">
          {formattedCount}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom: continent name */}
      <div className="relative">
        <div className="mb-3 h-px bg-white/[0.06]" />
        <h3 className="font-[family-name:var(--font-fraunces)] text-[1.55rem] leading-[1] font-semibold tracking-[-0.02em] text-white transition-colors duration-300 group-hover:text-white/90 sm:text-[1.7rem] lg:text-[1.9rem]">
          {continent.name}
        </h3>
        <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-white/32 uppercase tabular-nums transition-colors duration-300 group-hover:text-cyan-400/60">
          {formattedCount}{" "}
          {continent.libraryCount === 1 ? "library" : "libraries"} →
        </p>
      </div>
    </GlobalLink>
  )
}

ContinentTile.displayName = "ContinentTile"

export default ContinentTile
