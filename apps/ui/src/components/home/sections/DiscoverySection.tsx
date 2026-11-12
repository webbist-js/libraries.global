import type { NetworkSummary } from "@repo/shared-data"
import { type Locale, useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import {
  homepageLinkAttributes,
  homepageContentAttributes,
} from "@/components/home/homepage.analytics"
import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import type { EventSearchHit } from "@/lib/meilisearch"

export function DiscoverySection({
  continents,
  networks,
  events,
  locale,
}: {
  readonly continents: readonly HomepageContinentSummary[]
  readonly networks: readonly NetworkSummary[]
  readonly events: readonly EventSearchHit[]
  readonly locale: Locale
}) {
  const tStatic = useTranslations("staticUi")

  const countries = continents
    .flatMap((continent) =>
      (continent.countries ?? []).map((country) => ({
        ...country,
        href: `/${continent.slug}/${country.slug}`,
      }))
    )
    .sort((a, b) => b.libraryCount - a.libraryCount)
    .slice(0, 3)

  return (
    <section
      className="home-frame home-discovery"
      data-homepage-surface="paper"
      aria-label={tStatic("home.exploreIndex")}
    >
      <div>
        <h2 className="type-h3 home-discovery-title">
          {tStatic("home.findNext")}
        </h2>
        <p className="home-discovery-intro">{tStatic("home.placeToRead")}</p>
        <ul className="home-link-rows">
          <li>
            <GlobalLink
              href="/libraries?tg=public"
              {...homepageLinkAttributes("/libraries?tg=public")}
            >
              {tStatic("home.publicLibraries")}
            </GlobalLink>
          </li>
          <li>
            <GlobalLink
              href="/libraries?tg=national"
              {...homepageLinkAttributes("/libraries?tg=national")}
            >
              {tStatic("home.nationalLibraries")}
            </GlobalLink>
          </li>
          <li>
            <GlobalLink
              href="/libraries?tg=academic"
              {...homepageLinkAttributes("/libraries?tg=academic")}
            >
              {tStatic("home.academicLibraries")}
            </GlobalLink>
          </li>
        </ul>
        <GlobalLink
          href="/libraries"
          {...homepageLinkAttributes("/libraries")}
          className="home-text-link"
        >
          {tStatic("home.searchPlace")}
        </GlobalLink>
      </div>
      <div>
        <h2 className="type-h3 home-discovery-title">
          {tStatic("home.placeNetwork")}
        </h2>
        <p className="home-discovery-intro">
          {tStatic("home.exploreCountries")}
        </p>
        <ul className="home-link-rows">
          {countries.map((country) => (
            <li key={country.href}>
              <GlobalLink href={country.href}>
                {country.name}
                <span>
                  {country.libraryCount.toLocaleString(locale)} records
                </span>
              </GlobalLink>
            </li>
          ))}
          {networks.slice(0, 2).map((network) => (
            <li key={network.documentId}>
              <GlobalLink href={`/library-networks/${network.slug}`}>
                {network.name}
                <span>
                  {tStatic("home.networkPrefix")}{" "}
                  {network.libraryCount.toLocaleString(locale)}
                </span>
              </GlobalLink>
            </li>
          ))}
        </ul>
        <div className="home-inline-links">
          <GlobalLink
            href="/libraries"
            {...homepageLinkAttributes("/libraries")}
            className="home-text-link"
          >
            {tStatic("home.allPlaces")}
          </GlobalLink>
          <GlobalLink
            href="/library-networks"
            {...homepageLinkAttributes("/library-networks")}
            className="home-text-link"
          >
            {tStatic("home.networks")}
          </GlobalLink>
        </div>
      </div>
      <div>
        <h2 className="type-h3 home-discovery-title">
          {tStatic("home.upcoming")}
        </h2>
        {events.length ? (
          <ul className="home-link-rows home-event-rows">
            {events.slice(0, 3).map((event) => (
              <li key={event.documentId}>
                <GlobalLink
                  href={`/events/${event.documentId}`}
                  {...homepageContentAttributes("event", event.documentId)}
                >
                  <span>
                    {event.title}
                    <small>
                      {new Intl.DateTimeFormat(locale, {
                        day: "numeric",
                        month: "short",
                        timeZone: event.timezone || "UTC",
                      }).format(new Date(event.startTime))}{" "}
                      ·{" "}
                      {[event.library_name, event.library_city]
                        .filter(Boolean)
                        .join(", ")}
                    </small>
                  </span>
                </GlobalLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="home-discovery-intro">{tStatic("home.eventsEmpty")}</p>
        )}
        <GlobalLink
          href="/events"
          {...homepageLinkAttributes("/events")}
          className="home-text-link"
        >
          {tStatic("home.allEvents")}
        </GlobalLink>
      </div>
    </section>
  )
}
