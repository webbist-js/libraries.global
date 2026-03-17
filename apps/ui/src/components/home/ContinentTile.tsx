import type { Locale } from "next-intl"

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

  return (
    <article
      className={cn(
        homepagePanelClassName,
        "relative min-h-[18rem] overflow-hidden px-6 pt-6 pb-7"
      )}
    >
      <ContinentGlobeBackdrop continent={continent} />

      <div className="relative z-10 flex h-full flex-col justify-end">
        <div className="space-y-2 text-center">
          <h3 className="text-[clamp(1.85rem,3vw,2.35rem)] leading-none font-semibold tracking-[-0.05em] text-white">
            {continent.name}
          </h3>

          <p className="text-base text-white/58 tabular-nums">{libraryLabel}</p>
        </div>
      </div>
    </article>
  )
}

ContinentTile.displayName = "ContinentTile"

export default ContinentTile
