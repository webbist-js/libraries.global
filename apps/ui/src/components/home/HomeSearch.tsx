"use client"

import { useState } from "react"

import { LibrarySearchBox } from "@/components/index-page/LibrarySearchBox"
import {
  analyticsAttributes,
  captureAnalyticsEvent,
  pushAnalyticsEvent,
} from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"

/** Starting points that open the index already filtered. */
const TRY_SEARCHES = [
  { label: "Glasgow", href: "/libraries?q=Glasgow" },
  { label: "Cardiff", href: "/libraries?q=Cardiff" },
  { label: "National libraries", href: "/libraries?tg=national" },
  { label: "Open now", href: "/libraries?open=1" },
]

export default function HomeSearch() {
  const router = useRouter()
  const [locating, setLocating] = useState(false)

  function goToIndex(q: string) {
    router.push(q ? `/libraries?q=${encodeURIComponent(q)}` : "/libraries")
  }

  function nearMe() {
    pushAnalyticsEvent("near_me", {
      interaction_source: "home",
      action_type: "request",
    })
    const success = captureAnalyticsEvent("near_me", {
      interaction_source: "home",
      action_type: "success",
    })
    const denied = captureAnalyticsEvent("near_me", {
      interaction_source: "home",
      action_type: "denied",
    })
    const unavailable = captureAnalyticsEvent("near_me", {
      interaction_source: "home",
      action_type: "unavailable",
    })
    if (!navigator.geolocation) {
      unavailable()
      router.push("/libraries")

      return
    }
    setLocating(true)
    // Geolocation is only requested on explicit user click of "Near me"
    // eslint-disable-next-line sonarjs/no-intrusive-permissions
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        success()
        setLocating(false)
        router.push(
          `/libraries?nlat=${pos.coords.latitude.toFixed(4)}&nlng=${pos.coords.longitude.toFixed(4)}&sort=near`
        )
      },
      (error) => {
        if (error.code === 1) denied()
        else unavailable()
        setLocating(false)
        router.push("/libraries")
      },
      { timeout: 8000 }
    )
  }

  return (
    <div>
      <LibrarySearchBox
        id="home-search"
        analyticsSource="home"
        className="mt-9 max-w-[750px]"
        strong
        onSubmit={goToIndex}
        onNearMe={nearMe}
        locating={locating}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="mr-0.5 text-base" style={{ color: T.ink.dim }}>
          Try
        </span>
        {TRY_SEARCHES.map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            {...analyticsAttributes("navigation_action", {
              interaction_source: "home",
              content_type: "library",
              action_type: "open",
            })}
            className="rounded-full border bg-white px-3.5 py-2 text-sm font-medium no-underline transition-colors hover:border-(--t-accent-primary) hover:text-(--t-accent-primary-hover)"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
