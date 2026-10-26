"use client"

import { WIDGET_ACCENTS } from "@repo/shared-data"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"

import { EmptyState } from "@/components/ds/EmptyState"
import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import {
  type WidgetPresentationData,
  widgetDistance,
} from "@/components/widgets/presentation"
import { WidgetLibraryCard } from "@/components/widgets/WidgetLibraryCard"
import { useMounted } from "@/hooks/useMounted"
import { widgetCopy } from "@/lib/widgets/copy"

const WidgetMap = dynamic(() => import("@/components/widgets/WidgetMap"), {
  ssr: false,
  loading: () => (
    <p role="status" className="min-h-80 p-6">
      Loading map…
    </p>
  ),
})

export function useWidgetFinder(data: WidgetPresentationData) {
  const { config: c, type } = data
  const mounted = useMounted()
  const t = (text: string) => widgetCopy(c.locale, text)
  const accent = WIDGET_ACCENTS[c.accent]
  const [query, setQuery] = useState(""),
    [facility, setFacility] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [page, setPage] = useState(1),
    [viewChoice, setViewChoice] = useState<string | null>(null),
    [location, setLocation] = useState<{ lat: number; lng: number } | null>(
      null
    ),
    [locationState, setLocationState] = useState("")
  const [article, setArticle] = useState<HTMLDivElement | null>(null),
    [wide, setWide] = useState(false)
  useEffect(() => {
    if (!article || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) =>
      setWide((entries[0]?.contentRect.width ?? 0) >= 720)
    )
    observer.observe(article)

    return () => observer.disconnect()
  }, [article])
  const view = viewChoice ?? (wide && c.mapMode === "map" ? "map" : "list")
  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(c.locale)
    const filtered = data.rows.filter(
      (r) =>
        (!q ||
          `${r.name} ${r.city ?? ""} ${r.address}`
            .toLocaleLowerCase(c.locale)
            .includes(q)) &&
        (!facility || r.facilities[0] === "yes")
    )

    return location
      ? [...filtered].sort(
          (a, b) =>
            (a.location ? widgetDistance(location, a.location) : Infinity) -
            (b.location ? widgetDistance(location, b.location) : Infinity)
        )
      : filtered
  }, [data.rows, query, facility, location, c.locale])
  const pageCount = Math.max(1, Math.ceil(rows.length / c.pageSize)),
    currentPage = Math.min(page, pageCount),
    shown = rows.slice((currentPage - 1) * c.pageSize, currentPage * c.pageSize)
  const picked = rows.find((r) => r.documentId === selected)
  const askLocation = () => {
    if (!navigator.geolocation) {
      setLocationState(t("Location is unavailable. Search by town instead."))

      return
    }
    setLocationState(t("Waiting for your permission…"))
    // eslint-disable-next-line sonarjs/no-intrusive-permissions -- requested finder feature, invoked only by the visitor’s explicit location button.
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocation({ lat: p.coords.latitude, lng: p.coords.longitude })
        setLocationState(
          t("Sorted by distance. Your location is kept only in this page.")
        )
        setPage(1)
      },
      () =>
        setLocationState(t("Location was not shared. Search by town instead.")),
      { timeout: 10000, maximumAge: 60000 }
    )
  }
  const selectLibrary = (id: string) => {
    setSelected(id)
    setViewChoice("map")
  }

  return {
    c,
    type,
    mounted,
    t,
    accent,
    setArticle,
    query,
    setQuery,
    facility,
    setFacility,
    selected,
    setSelected,
    page,
    setPage,
    viewChoice,
    setViewChoice,
    location,
    setLocation,
    locationState,
    setLocationState,
    wide,
    view,
    rows,
    pageCount,
    currentPage,
    shown,
    picked,
    askLocation,
    selectLibrary,
    total: data.rows.length,
  }
}

type FinderModel = ReturnType<typeof useWidgetFinder>
function WidgetFinderFilters({
  model,
}: {
  readonly model: FinderModel
  readonly siteUrl: string
}) {
  const {
    c,
    type,
    mounted,
    t,
    query,
    setQuery,
    facility,
    setFacility,
    setPage,
    location,
    setLocation,
    setLocationState,
    askLocation,
  } = model

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {c.search ? (
        <label className="min-w-[180px] flex-1 basis-full @min-[520px]:basis-auto">
          <span className="sr-only">{t("Search by library or town")}</span>
          <input
            className={STAFF_FIELD}
            type="search"
            disabled={!mounted}
            placeholder={t("Search by library or town")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
        </label>
      ) : null}
      {type === "finder" && c.locate ? (
        <Button
          variant="surface"
          size="pill"
          onClick={askLocation}
          disabled={!mounted}
        >
          {t("Use my location")}
        </Button>
      ) : null}
      {c.facilityFilter ? (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!mounted}
            checked={facility}
            onChange={(e) => {
              setFacility(e.target.checked)
              setPage(1)
            }}
          />
          {t("Step-free entrance")}
        </label>
      ) : null}
      {query || facility || location ? (
        <Button
          variant="link"
          className="min-h-11"
          onClick={() => {
            setQuery("")
            setFacility(false)
            setLocation(null)
            setLocationState("")
            setPage(1)
          }}
        >
          {t("Clear filters")}
        </Button>
      ) : null}
    </div>
  )
}
function WidgetFinderSummary({
  model,
}: {
  readonly model: FinderModel
  readonly siteUrl: string
}) {
  const { type, t, rows } = model

  return (
    <p className="mb-3 text-sm text-(--t-ink-dim)" role="status">
      {rows.length} {t("libraries")}
      {type === "finder"
        ? ` · ${rows.filter((r) => r.location).length} ${t("mapped")} · ${rows.filter((r) => !r.location).length} ${t("missing coordinates")}`
        : ""}
    </p>
  )
}
function WidgetMapPane({
  model,
}: {
  readonly model: FinderModel
  readonly siteUrl: string
}) {
  const { c, t, accent, selected, setSelected, wide, view, rows, picked } =
    model

  return (
    <div
      className={`${view === "map" ? "block" : "hidden"} ${c.mapMode === "both" ? "@min-[720px]:block" : ""}`}
    >
      {view === "map" || (wide && c.mapMode === "both") ? (
        <WidgetMap
          rows={rows}
          selected={selected}
          onSelect={setSelected}
          accent={accent}
          clusters={c.clusters}
          labels={c.labels}
          reset={c.reset}
          locale={c.locale}
        />
      ) : null}
      {picked ? (
        <aside
          className="mt-3 rounded-xl bg-(--t-bg-surface) p-4"
          aria-label={t("Selected library")}
        >
          <strong>{picked.name}</strong>
          <p className="mt-1 text-sm">{picked.address}</p>
          <Button
            variant="link"
            className="min-h-11 px-0"
            onClick={() => setSelected(null)}
          >
            {t("Close selection")}
          </Button>
        </aside>
      ) : null}
    </div>
  )
}
function WidgetListPane({
  model,
  siteUrl,
}: {
  readonly model: FinderModel
  readonly siteUrl: string
}) {
  const {
    c,
    type,
    t,
    accent,
    selected,
    setPage,
    location,
    view,
    pageCount,
    currentPage,
    shown,
    selectLibrary,
  } = model

  return (
    <div
      className={
        type === "finder"
          ? `${view === "list" ? "block" : "hidden"} ${c.mapMode === "both" ? "@min-[720px]:block" : ""}`
          : "block"
      }
    >
      <ul
        className={`m-0 grid list-none gap-3 p-0 ${type === "finder" ? "max-h-[520px] overflow-y-auto overscroll-contain" : ""} ${type === "directory" && c.directoryLayout === "cards" ? "@min-[640px]:grid-cols-2" : ""}`}
        aria-label={t("Selected libraries")}
      >
        {shown.map((r) => (
          <WidgetLibraryCard
            key={r.documentId}
            r={r}
            c={c}
            type={type}
            accent={accent}
            selected={selected}
            onSelect={selectLibrary}
            siteUrl={siteUrl}
            location={location}
          />
        ))}
      </ul>
      {pageCount > 1 ? (
        <nav
          aria-label={t("Library pages")}
          className="mt-4 flex flex-wrap items-center justify-between gap-2"
        >
          <Button
            variant="surface"
            size="pill"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            {t("Previous")}
          </Button>
          <span className="text-sm">
            {currentPage} / {pageCount}
          </span>
          <Button
            variant="surface"
            size="pill"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            {t("Next")}
          </Button>
        </nav>
      ) : null}
    </div>
  )
}

export function WidgetFinder({
  data,
  siteUrl,
}: {
  readonly data: WidgetPresentationData
  readonly siteUrl: string
}) {
  const model = useWidgetFinder(data)
  const {
    setArticle,
    total,
    c,
    type,
    mounted,
    t,
    setQuery,
    setFacility,
    setViewChoice,
    locationState,
    view,
    rows,
  } = model

  return (
    <div ref={setArticle}>
      <WidgetFinderFilters model={model} siteUrl={siteUrl} />
      <WidgetFinderSummary model={model} siteUrl={siteUrl} />
      {locationState ? (
        <p role="status" className="mb-3 text-sm">
          {locationState}
        </p>
      ) : null}
      {type === "finder" ? (
        <div
          className={c.mapMode === "both" ? "mb-4 @min-[720px]:hidden" : "mb-4"}
        >
          <fieldset disabled={!mounted} className="m-0 min-w-0 border-0 p-0">
            <legend className="sr-only">{t("Library view")}</legend>
            <SegmentedControl
              label={t("Library view")}
              value={view}
              onChange={setViewChoice}
              options={[
                { value: "list", label: t("List") },
                { value: "map", label: t("Map") },
              ]}
            />
          </fieldset>
        </div>
      ) : null}
      {!rows.length ? (
        <EmptyState
          compact
          lead={
            total
              ? t("No libraries match")
              : t("No published libraries available")
          }
          detail={t(
            "Try another library name or town, or clear the facility filter."
          )}
          action={
            <Button
              variant="surface"
              size="pill"
              onClick={() => {
                setQuery("")
                setFacility(false)
              }}
            >
              {t("Clear filters")}
            </Button>
          }
        />
      ) : (
        <div
          className={
            type === "finder" && c.mapMode === "both"
              ? "grid gap-4 @min-[720px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
              : "grid gap-4"
          }
        >
          {type === "finder" ? (
            <WidgetMapPane model={model} siteUrl={siteUrl} />
          ) : null}
          <WidgetListPane model={model} siteUrl={siteUrl} />
        </div>
      )}
    </div>
  )
}
