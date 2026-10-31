import type { NetworkSummary } from "@repo/shared-data"
import type { Locale } from "next-intl"

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
      aria-label="Explore the library index"
    >
      <div>
        <h2 className="type-h3 home-discovery-title">Find your next library</h2>
        <p className="home-discovery-intro">
          A place to read, research, learn or simply spend a little time.
        </p>
        <ul className="home-link-rows">
          <li>
            <GlobalLink
              href="/libraries?tg=public"
              {...homepageLinkAttributes("/libraries?tg=public")}
            >
              Public libraries
            </GlobalLink>
          </li>
          <li>
            <GlobalLink
              href="/libraries?tg=national"
              {...homepageLinkAttributes("/libraries?tg=national")}
            >
              National libraries
            </GlobalLink>
          </li>
          <li>
            <GlobalLink
              href="/libraries?tg=academic"
              {...homepageLinkAttributes("/libraries?tg=academic")}
            >
              Academic libraries
            </GlobalLink>
          </li>
        </ul>
        <GlobalLink
          href="/libraries"
          {...homepageLinkAttributes("/libraries")}
          className="home-text-link"
        >
          Search by name or place
        </GlobalLink>
      </div>
      <div>
        <h2 className="type-h3 home-discovery-title">By place and network</h2>
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
                  Network · {network.libraryCount.toLocaleString(locale)}
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
            All places
          </GlobalLink>
          <GlobalLink
            href="/library-networks"
            {...homepageLinkAttributes("/library-networks")}
            className="home-text-link"
          >
            Library networks
          </GlobalLink>
        </div>
      </div>
      <div>
        <h2 className="type-h3 home-discovery-title">Upcoming at libraries</h2>
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
          <p className="home-discovery-intro">
            Talks, exhibitions, storytimes and workshops. Discover what’s on as
            more library calendars join the index.
          </p>
        )}
        <GlobalLink
          href="/events"
          {...homepageLinkAttributes("/events")}
          className="home-text-link"
        >
          All events
        </GlobalLink>
      </div>
    </section>
  )
}
