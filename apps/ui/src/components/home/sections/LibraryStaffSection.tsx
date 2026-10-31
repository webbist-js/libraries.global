import GlobalLink from "@/components/global/GlobalLink"
import { homepageLinkAttributes } from "@/components/home/homepage.analytics"
import { plainHomepageTitle } from "@/components/home/homepage.constants"
import type { CtaBand, LinkCard } from "@/components/home/homepage.types"
import { HomeStaffTools } from "@/components/home/HomeStaffTools"

export function LibraryStaffSection({
  band,
  tools,
}: {
  readonly band: CtaBand
  readonly tools: readonly LinkCard[]
}) {
  return (
    <section
      className="home-frame home-split home-staff"
      data-homepage-surface="paper"
      aria-labelledby="home-staff-title"
    >
      <div>
        <p className="home-kicker">For libraries</p>
        <h2 id="home-staff-title" className="type-h2">
          {plainHomepageTitle(band.title)}
        </h2>
        <p className="home-section-copy">{band.text}</p>
        <GlobalLink
          href={band.primaryHref}
          {...homepageLinkAttributes(band.primaryHref)}
          className="home-button home-button-ink"
        >
          {band.primaryLabel}
        </GlobalLink>
      </div>
      <div>
        <HomeStaffTools tools={tools} />
        <div className="home-inline-links">
          <GlobalLink
            href={band.secondaryHref}
            {...homepageLinkAttributes(band.secondaryHref)}
            className="home-text-link"
          >
            {band.secondaryLabel}
          </GlobalLink>
          <GlobalLink
            href="/staff"
            {...homepageLinkAttributes("/staff")}
            className="home-text-link"
          >
            Explore staff area
          </GlobalLink>
        </div>
      </div>
    </section>
  )
}
