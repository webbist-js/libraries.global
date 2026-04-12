import type { Locale } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import ContinentGlobeBackdrop from "@/components/home/ContinentGlobeBackdrop"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import { cn } from "@/lib/styles"

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
  const libraryLabel = `${formattedCount} ${
    continent.libraryCount === 1 ? "Library" : "Libraries"
  }`
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
      className={cn(
        homepagePanelClassName,
        "group relative block min-h-[18rem] overflow-visible px-6 pt-6 pb-7 transition-[border-color,box-shadow,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-cyan-200/16 hover:bg-white/[0.05] hover:shadow-[0_30px_100px_rgba(6,16,40,0.38),inset_0_0_0_1px_rgba(177,233,255,0.06)] focus-visible:border-cyan-200/16 focus-visible:bg-white/[0.05] focus-visible:shadow-[0_30px_100px_rgba(6,16,40,0.38),inset_0_0_0_1px_rgba(177,233,255,0.06)] focus-visible:outline-none"
      )}
    >
      <div className="pointer-events-none absolute inset-[-10%] rounded-[38px] bg-[radial-gradient(circle_at_50%_82%,rgba(84,171,255,0.18),transparent_42%),radial-gradient(circle_at_50%_26%,rgba(104,186,255,0.12),transparent_34%)] opacity-0 blur-3xl transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 group-focus-visible:opacity-100" />
      <div className="pointer-events-none absolute inset-x-[-8%] bottom-[-8%] h-24 rounded-full bg-[radial-gradient(circle,rgba(84,171,255,0.26),transparent_68%)] opacity-0 blur-[42px] transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 group-focus-visible:opacity-100" />

      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="pointer-events-none absolute inset-x-[14%] bottom-0 h-20 rounded-full bg-[radial-gradient(circle,rgba(84,171,255,0.16),transparent_70%)] opacity-0 blur-3xl transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100 group-focus-visible:opacity-100" />
        <ContinentGlobeBackdrop continent={continent} />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-end">
        <div className="space-y-2 text-center transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
          <h3 className="text-[clamp(1.85rem,3vw,2.35rem)] leading-none font-semibold tracking-[-0.05em] text-white transition-[text-shadow,color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-cyan-50 group-hover:[text-shadow:0_0_24px_rgba(148,224,255,0.18)] group-focus-visible:text-cyan-50 group-focus-visible:[text-shadow:0_0_24px_rgba(148,224,255,0.18)]">
            {continent.name}
          </h3>

          <p className="text-base text-white/58 tabular-nums transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-cyan-100/78 group-focus-visible:text-cyan-100/78">
            {libraryLabel}
          </p>
        </div>
      </div>
    </GlobalLink>
  )
}

ContinentTile.displayName = "ContinentTile"

export default ContinentTile
