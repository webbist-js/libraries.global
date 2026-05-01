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
      className="group relative flex h-[200px] flex-col overflow-hidden rounded-2xl p-5 transition-all duration-500 hover:border-(--t-border-hi) hover:bg-(--t-bg-surface) focus-visible:ring-2 focus-visible:ring-(--t-border-hi) focus-visible:outline-none sm:h-[220px] lg:h-[260px]"
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      {/* Subtle hover glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(84,171,255,0.06),transparent_65%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Top row: continent code + count */}
      <div className="relative flex items-start justify-between">
        <span className="font-mono text-[10px] tracking-[0.22em] text-(--t-ink-faint) uppercase">
          {continent.code ?? "—"}
        </span>
        <span className="font-mono text-[10px] tracking-[0.14em] text-(--t-ink-faint) tabular-nums">
          {formattedCount}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom: continent name */}
      <div className="relative">
        <div className="mb-3 h-px bg-(--t-border-line)" />
        <h3 className="font-[family-name:var(--font-fraunces)] text-[1.55rem] leading-[1] font-semibold tracking-[-0.02em] text-(--t-ink-base) transition-colors duration-300 group-hover:text-(--t-ink-dim) sm:text-[1.7rem] lg:text-[1.9rem]">
          {continent.name}
        </h3>
        <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-(--t-ink-faint) uppercase tabular-nums transition-colors duration-300 group-hover:text-(--t-accent-aurora)">
          {formattedCount}{" "}
          {continent.libraryCount === 1 ? "library" : "libraries"} →
        </p>
      </div>
    </GlobalLink>
  )
}

ContinentTile.displayName = "ContinentTile"

export default ContinentTile
