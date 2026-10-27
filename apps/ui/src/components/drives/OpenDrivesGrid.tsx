"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useMemo, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { distanceKm } from "@/components/index-page/find-helpers"
import { T } from "@/lib/design-tokens"
import { type DriveView, orderByDistance } from "@/lib/drives/drive-view"

import { DriveCard } from "./DriveCard"

const PILL =
  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-base font-semibold transition-colors"

const GEO_ERROR = "We couldn’t get your location."

const toggleStyle = (on: boolean) =>
  on
    ? {
        background: T.accent.chip,
        borderColor: T.accent.primary,
        color: T.accent.primaryHover,
      }
    : { borderColor: T.border.hi, color: T.ink.base }

/**
 * The Noticeboard's "Other open drives" grid (spec §5.5): "Near me" orders
 * the drives by distance from the reader, asking for the location only on
 * the first press, and each card then gains "{n} km away"; "Places I
 * follow" (signed-in only) narrows to drives with work to do in a region
 * the reader follows. Both can be on together: filter, then order.
 */
export function OpenDrivesGrid({
  views,
  followed,
  now,
}: {
  readonly views: readonly DriveView[]
  /** Drive documentIds with work in a place the reader follows; null when signed out. */
  readonly followed: string[] | null
  readonly now?: Date
}) {
  const tUi = useUiTranslations("ui")

  const [followOn, setFollowOn] = useState(false)
  const [near, setNear] = useState(false)
  const [locating, setLocating] = useState(false)
  const [nearError, setNearError] = useState<string | null>(null)
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(
    null
  )

  const followedSet = useMemo(() => new Set(followed), [followed])

  const filtered = followOn
    ? views.filter((v) => followedSet.has(v.drive.documentId))
    : views
  const sorted = near && origin ? orderByDistance(filtered, origin) : filtered

  const distances = useMemo(() => {
    if (!(near && origin)) return null
    const map = new Map<string, number>()
    for (const v of sorted) {
      const centroid = v.drive.baseline?.centroid
      if (centroid) {
        map.set(
          v.drive.documentId,
          Math.round(
            distanceKm(origin.lat, origin.lng, centroid.lat, centroid.lng)
          )
        )
      }
    }

    return map
  }, [near, origin, sorted])

  const toggleNear = () => {
    if (near) {
      setNear(false)

      return
    }
    setNearError(null)
    const geo = globalThis.navigator?.geolocation
    const fail = () => {
      setLocating(false)
      setNearError(GEO_ERROR)
    }
    if (!geo) {
      fail()

      return
    }
    setLocating(true)
    geo.getCurrentPosition(
      (pos) => {
        setLocating(false)
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setNear(true)
      },
      fail,
      { maximumAge: 300_000, timeout: 10_000 }
    )
  }

  const liveMessage = [
    followOn ? "Showing drives in places you follow" : null,
    near && origin ? "Sorted by distance from you" : null,
  ]
    .filter(Boolean)
    .join(". ")

  return (
    <div className="flex flex-col gap-3.5">
      <div
        role="group"
        aria-label={tUi("order_drives")}
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          aria-pressed={near}
          onClick={toggleNear}
          className={`${PILL} ${near ? "" : "bg-white hover:bg-(--t-bg-surface)"}`}
          style={toggleStyle(near)}
        >
          <Icon
            aria-hidden="true"
            height={17}
            icon={locating ? "mdi:loading" : "mdi:crosshairs-gps"}
            className={
              locating ? "animate-spin motion-reduce:animate-none" : undefined
            }
            width={17}
          />
          Near me
        </button>
        {followed !== null ? (
          <button
            type="button"
            aria-pressed={followOn}
            onClick={() => setFollowOn((v) => !v)}
            className={`${PILL} ${followOn ? "" : "bg-white hover:bg-(--t-bg-surface)"}`}
            style={toggleStyle(followOn)}
          >
            <Icon
              aria-hidden="true"
              height={17}
              icon="mdi:map-marker-star-outline"
              width={17}
            />
            Places I follow
          </button>
        ) : null}
      </div>

      {nearError ? (
        <p
          role="alert"
          className="m-0 text-sm font-semibold"
          style={{ color: T.accent.danger }}
        >
          {nearError}
        </p>
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className="m-0 text-sm font-semibold"
        style={{ color: T.ink.dim }}
      >
        {liveMessage}
      </p>

      {followOn && sorted.length === 0 ? (
        <p className="m-0 text-base" style={{ color: T.ink.dim }}>
          None of the open drives cover places you follow.{" "}
          <GlobalLink
            href="/libraries"
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Follow libraries
          </GlobalLink>
        </p>
      ) : (
        <ul
          className="m-0 grid list-none gap-3.5 p-0"
          style={{
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
          }}
        >
          {sorted.map((view) => (
            <li key={view.drive.documentId} className="flex flex-col gap-1.5">
              <DriveCard view={view} now={now} />
              {distances?.has(view.drive.documentId) ? (
                <span
                  className="px-1 text-sm font-semibold"
                  style={{ color: T.ink.dim }}
                >
                  {distances.get(view.drive.documentId)} km away
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
