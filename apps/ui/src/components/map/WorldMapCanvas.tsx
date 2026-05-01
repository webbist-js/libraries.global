"use client"

import { useEffect, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { cn } from "@/lib/styles"

// ── Types ──────────────────────────────────────────────────────────────────────

interface LibraryMapPin {
  documentId: string
  name: string
  slug: string
  libraryType?: string | null
  operationalStatus?: string | null
  city?: string | null
  location: { lat: number; lng: number }
  continent?: { slug: string } | null
  country?: { slug: string } | null
  region?: { slug: string } | null
}

interface GeoMapPin {
  documentId: string
  name: string
  slug: string
  lat?: number | null
  lng?: number | null
  boundingBoxNE?: string | null
  boundingBoxSW?: string | null
  boundaryUrl?: string | null
  continent?: { slug: string } | null
  country?: { slug: string } | null
  region?: { slug: string } | null
}

type DrillLevel =
  | "world"
  | "continent"
  | "country"
  | "region"
  | "area"
  | "library"

interface BreadcrumbEntry {
  label: string
  level: DrillLevel
  continentSlug?: string
  countrySlug?: string
  regionSlug?: string
  areaSlug?: string
  boundingBoxNE?: string | null
  boundingBoxSW?: string | null
}

export interface MapFilterParams {
  libraryTypes?: string[]
  operationalStatuses?: string[]
}

export interface WorldMapCanvasProps {
  locale?: string
  filterParams?: MapFilterParams
  onLibraryPinsChange?: (count: number) => void
  /** When set, skip world-level continent view and jump straight to this continent */
  initialContinentSlug?: string
  initialContinentName?: string
  /** Called when the user navigates back past the top breadcrumb to world level */
  onBackToGlobe?: () => void
  className?: string
}

// ── Layer IDs ──────────────────────────────────────────────────────────────────

const LIB_LAYERS = [
  "library-clusters",
  "library-cluster-count",
  "library-pins",
] as const
const LIB_SOURCES = ["libraries"] as const
const GEO_LAYERS = ["geo-fills", "geo-outlines"] as const
const GEO_SOURCES = ["geo-areas"] as const

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseBounds(ne?: string | null, sw?: string | null) {
  if (!ne || !sw) return null
  const [neLat, neLng] = ne.split(",").map(Number)
  const [swLat, swLng] = sw.split(",").map(Number)
  if ([neLat, neLng, swLat, swLng].some((v) => v == null || Number.isNaN(v)))
    return null

  return { neLat, neLng, swLat, swLng } as const
}

async function fetchPins<T>(
  path: string,
  params: Record<string, string>
): Promise<T[]> {
  const q = new URLSearchParams(params)
  try {
    const res = await fetch(`/api/public-proxy/api/${path}?${q}`)
    if (!res.ok) return []
    const json = (await res.json()) as { data?: T[] }

    return json.data ?? []
  } catch {
    return []
  }
}

function buildLibraryHref(pin: LibraryMapPin): string | null {
  const c = pin.continent?.slug
  const co = pin.country?.slug
  const r = pin.region?.slug
  if (c && co && r && pin.slug) return `/${c}/${co}/${r}/${pin.slug}`

  return null
}

function operationalLabel(status?: string | null) {
  const map: Record<string, string> = {
    open: "Open",
    temporarily_closed: "Temporarily Closed",
    permanently_closed: "Permanently Closed",
    seasonal: "Seasonal",
    appointment_only: "By Appointment",
    planned: "Planned",
  }

  return map[status ?? ""] ?? "Unknown"
}

// ── Component ──────────────────────────────────────────────────────────────────

export function WorldMapCanvas({
  locale = "en",
  filterParams,
  onLibraryPinsChange,
  initialContinentSlug,
  initialContinentName,
  onBackToGlobe,
  className,
}: WorldMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoMarkersRef = useRef<any[]>([])
  const geoGenRef = useRef(0)

  const [mapReady, setMapReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPin, setSelectedPin] = useState<LibraryMapPin | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([])

  // View state ref — stable across closures
  const viewRef = useRef<{
    level: DrillLevel
    continentSlug?: string
    countrySlug?: string
    regionSlug?: string
    areaSlug?: string
  }>({ level: "world" })

  // Stable callback refs so event handlers always call the latest version
  const setSelectedPinRef = useRef(setSelectedPin)
  setSelectedPinRef.current = setSelectedPin
  const setBreadcrumbRef = useRef(setBreadcrumb)
  setBreadcrumbRef.current = setBreadcrumb
  const setLoadingRef = useRef(setLoading)
  setLoadingRef.current = setLoading
  const onLibraryPinsChangeRef = useRef(onLibraryPinsChange)
  onLibraryPinsChangeRef.current = onLibraryPinsChange
  const filterParamsRef = useRef(filterParams)
  filterParamsRef.current = filterParams

  // ── Map init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return
    let alive = true

    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (!alive || !containerRef.current) return

      const isLight =
        document.documentElement.classList.contains("light") ||
        document.documentElement.dataset.theme === "light"
      const mapStyle = isLight
        ? "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json"

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyle,
        center: [10, 20],
        zoom: 2,
        minZoom: 1.5,
        renderWorldCopies: false,
        attributionControl: false,
      })

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right"
      )
      mapRef.current = map

      map.on("load", () => {
        if (alive) {
          map.resize()
          setMapReady(true)
        }
      })

      // Resize the map whenever its container changes dimensions
      const ro = new ResizeObserver(() => {
        mapRef.current?.resize()
      })
      if (containerRef.current) ro.observe(containerRef.current)
      roRef.current = ro
    })

    return () => {
      alive = false
      roRef.current?.disconnect()
      roRef.current = null
      geoMarkersRef.current.forEach((m) => m.remove())
      geoMarkersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // ── Initial load — fetch all continent boundaries ─────────────────────────

  useEffect(() => {
    if (!mapReady) return
    setLoading(true)

    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (initialContinentSlug) {
        // Started from globe — skip world level, jump straight to country drill
        viewRef.current = {
          level: "continent",
          continentSlug: initialContinentSlug,
        }
        setBreadcrumbRef.current([
          {
            label: initialContinentName ?? initialContinentSlug,
            level: "continent",
            continentSlug: initialContinentSlug,
          },
        ])
        fetchPins<GeoMapPin>("countries/map-pins", {
          continentSlug: initialContinentSlug,
          locale,
          status: "published",
        }).then((countryPins) => {
          if (countryPins.length > 0) {
            renderGeoBoundaries(maplibregl, countryPins, "country").then(() =>
              setLoading(false)
            )
          } else {
            setLoading(false)
          }
        })

        return
      }

      fetchPins<GeoMapPin>("continents/map-pins", {
        locale,
        status: "published",
      }).then((pins) => {
        if (pins.length === 0) {
          setLoading(false)

          return
        }
        // Always use the baked-in world-continents.geojson for the continent overview.
        // Strapi's per-continent boundaryUrl points to per-country files (e.g. /continents/europe.geojson)
        // which contain individual country features — they don't have a matching continent-level slug.
        const pinsWithBoundaries = pins.map((p) => ({
          ...p,
          boundaryUrl: "/boundaries/world-continents.geojson",
        }))
        renderGeoBoundaries(maplibregl, pinsWithBoundaries, "continent").then(
          () => setLoading(false)
        )
      })
    })
  }, [mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-render library pins when filterParams change ───────────────────────

  useEffect(() => {
    if (!mapReady) return
    const level = viewRef.current.level
    if (level !== "library") return // only re-query when library pins are visible

    import("maplibre-gl").then(() => {
      const { areaSlug, regionSlug, countrySlug, continentSlug } =
        viewRef.current
      const extra = buildFilterQuery(filterParams)
      if (areaSlug) {
        fetchPins<LibraryMapPin>("libraries/map-pins", {
          areaSlug,
          locale,
          status: "published",
          ...extra,
        }).then((pins) => renderLibraryPins(pins))
      } else if (regionSlug) {
        fetchPins<LibraryMapPin>("libraries/map-pins", {
          regionSlug,
          locale,
          status: "published",
          ...extra,
        }).then((pins) => renderLibraryPins(pins))
      } else if (countrySlug) {
        fetchPins<LibraryMapPin>("libraries/map-pins", {
          countrySlug,
          locale,
          status: "published",
          ...extra,
        }).then((pins) => renderLibraryPins(pins))
      } else if (continentSlug) {
        fetchPins<LibraryMapPin>("libraries/map-pins", {
          continentSlug,
          locale,
          status: "published",
          ...extra,
        }).then((pins) => renderLibraryPins(pins))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filterParams?.libraryTypes?.join(","),
    filterParams?.operationalStatuses?.join(","),
  ])

  // ── Clear helpers ──────────────────────────────────────────────────────────

  function clearLibraryLayers() {
    const map = mapRef.current
    if (!map) return
    for (const id of LIB_LAYERS) if (map.getLayer(id)) map.removeLayer(id)
    for (const id of LIB_SOURCES) if (map.getSource(id)) map.removeSource(id)
  }

  function clearGeoBoundaryLayers() {
    const map = mapRef.current
    if (!map) return
    for (const id of GEO_LAYERS) if (map.getLayer(id)) map.removeLayer(id)
    for (const id of GEO_SOURCES) if (map.getSource(id)) map.removeSource(id)
    geoMarkersRef.current.forEach((m) => m.remove())
    geoMarkersRef.current = []
  }

  // ── Zoom helpers ───────────────────────────────────────────────────────────

  function zoomToPin(pin: GeoMapPin, fallbackZoom: number) {
    const map = mapRef.current
    if (!map) return
    const b = parseBounds(pin.boundingBoxNE, pin.boundingBoxSW)
    if (b) {
      map.fitBounds(
        [
          [b.swLng, b.swLat],
          [b.neLng, b.neLat],
        ],
        { padding: 60, duration: 900 }
      )
    } else if (pin.lat != null && pin.lng != null) {
      map.easeTo({
        center: [pin.lng, pin.lat],
        zoom: fallbackZoom,
        duration: 800,
      })
    }
  }

  // ── Library pins ───────────────────────────────────────────────────────────

  function renderLibraryPins(pins: LibraryMapPin[]) {
    const map = mapRef.current
    if (!map) return
    clearLibraryLayers()
    clearGeoBoundaryLayers()
    setSelectedPinRef.current(null)
    viewRef.current = { ...viewRef.current, level: "library" }
    onLibraryPinsChangeRef.current?.(pins.length)

    const geojson = {
      type: "FeatureCollection" as const,
      features: pins.map((pin) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [pin.location.lng, pin.location.lat],
        },
        properties: {
          documentId: pin.documentId,
          name: pin.name,
          slug: pin.slug,
          libraryType: pin.libraryType ?? "",
          operationalStatus: pin.operationalStatus ?? "",
          city: pin.city ?? "",
          continentSlug: pin.continent?.slug ?? "",
          countrySlug: pin.country?.slug ?? "",
          regionSlug: pin.region?.slug ?? "",
        },
      })),
    }

    map.addSource("libraries", {
      type: "geojson",
      data: geojson,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 40,
    })

    map.addLayer({
      id: "library-clusters",
      type: "circle",
      source: "libraries",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#6366f1",
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
        "circle-opacity": 0.85,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "rgba(99,102,241,0.35)",
      },
    })

    map.addLayer({
      id: "library-cluster-count",
      type: "symbol",
      source: "libraries",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["to-string", ["get", "point_count"]],
        "text-size": 11,
      },
      paint: { "text-color": "#ffffff" },
    })

    map.addLayer({
      id: "library-pins",
      type: "circle",
      source: "libraries",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 7,
        "circle-color": "#6366f1",
        "circle-opacity": 0.92,
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(255,255,255,0.3)",
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("click", "library-clusters", (e: any) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["library-clusters"],
      })
      if (!features.length) return
      const clusterId = features[0].properties.cluster_id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(map.getSource("libraries") as any).getClusterExpansionZoom(
        clusterId,

        (_err: unknown, zoom: number) => {
          map.easeTo({
            center: (features[0].geometry as any).coordinates,
            zoom,
          })
        }
      )
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("click", "library-pins", (e: any) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["library-pins"],
      })
      if (!features.length) return
      const p = features[0].properties
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coords = (features[0].geometry as any).coordinates as [
        number,
        number,
      ]
      setSelectedPinRef.current({
        documentId: p.documentId as string,
        name: p.name as string,
        slug: p.slug as string,
        libraryType: (p.libraryType as string) || null,
        operationalStatus: (p.operationalStatus as string) || null,
        city: (p.city as string) || null,
        location: { lat: coords[1], lng: coords[0] },
        continent: p.continentSlug ? { slug: p.continentSlug as string } : null,
        country: p.countrySlug ? { slug: p.countrySlug as string } : null,
        region: p.regionSlug ? { slug: p.regionSlug as string } : null,
      })
    })

    map.on("mouseenter", "library-pins", () => {
      map.getCanvas().style.cursor = "pointer"
    })
    map.on("mouseleave", "library-pins", () => {
      map.getCanvas().style.cursor = ""
    })
    map.on("mouseenter", "library-clusters", () => {
      map.getCanvas().style.cursor = "pointer"
    })
    map.on("mouseleave", "library-clusters", () => {
      map.getCanvas().style.cursor = ""
    })
  }

  // ── Geo boundaries ─────────────────────────────────────────────────────────

  async function renderGeoBoundaries(
    maplibregl: any,
    pins: GeoMapPin[],
    type: "continent" | "country" | "region" | "area"
  ) {
    const map = mapRef.current
    if (!map) return
    clearLibraryLayers()
    clearGeoBoundaryLayers()
    setSelectedPinRef.current(null)

    const gen = ++geoGenRef.current
    const color =
      type === "continent"
        ? "#38bdf8"
        : type === "country"
          ? "#22d3ee"
          : type === "region"
            ? "#f59e0b"
            : "#a78bfa"
    const fallbackZoom =
      type === "continent"
        ? 4
        : type === "country"
          ? 6
          : type === "region"
            ? 9
            : 11

    // ── Drill-down handler ──────────────────────────────────────────────────

    function drillInto(pin: GeoMapPin) {
      if (geoGenRef.current !== gen) return
      zoomToPin(pin, fallbackZoom)
      setLoadingRef.current(true)

      switch (type) {
        case "continent":
          viewRef.current = {
            ...viewRef.current,
            continentSlug: pin.slug,
            level: "continent",
          }
          setBreadcrumbRef.current((prev) => [
            ...prev,
            {
              label: pin.name,
              level: "continent" as DrillLevel,
              continentSlug: pin.slug,
              boundingBoxNE: pin.boundingBoxNE ?? null,
              boundingBoxSW: pin.boundingBoxSW ?? null,
            },
          ])
          fetchPins<GeoMapPin>("countries/map-pins", {
            continentSlug: pin.slug,
            locale,
            status: "published",
          }).then((countryPins) => {
            if (countryPins.length > 0) {
              renderGeoBoundaries(maplibregl, countryPins, "country").then(() =>
                setLoadingRef.current(false)
              )
            } else {
              fetchPins<LibraryMapPin>("libraries/map-pins", {
                continentSlug: pin.slug,
                locale,
                status: "published",
                ...buildFilterQuery(filterParamsRef.current),
              }).then((libPins) => {
                renderLibraryPins(libPins)
                setLoadingRef.current(false)
              })
            }
          })

          break

        case "country":
          viewRef.current = {
            ...viewRef.current,
            countrySlug: pin.slug,
            level: "country",
          }
          setBreadcrumbRef.current((prev) => [
            ...prev,
            {
              label: pin.name,
              level: "country" as DrillLevel,
              countrySlug: pin.slug,
              continentSlug: pin.continent?.slug,
              boundingBoxNE: pin.boundingBoxNE ?? null,
              boundingBoxSW: pin.boundingBoxSW ?? null,
            },
          ])
          fetchPins<GeoMapPin>("regions/map-pins", {
            countrySlug: pin.slug,
            locale,
            status: "published",
          }).then((regionPins) => {
            if (regionPins.length > 0) {
              renderGeoBoundaries(maplibregl, regionPins, "region").then(() =>
                setLoadingRef.current(false)
              )
            } else {
              fetchPins<LibraryMapPin>("libraries/map-pins", {
                countrySlug: pin.slug,
                locale,
                status: "published",
                ...buildFilterQuery(filterParamsRef.current),
              }).then((libPins) => {
                renderLibraryPins(libPins)
                setLoadingRef.current(false)
              })
            }
          })

          break

        case "region":
          viewRef.current = {
            ...viewRef.current,
            regionSlug: pin.slug,
            level: "region",
          }
          setBreadcrumbRef.current((prev) => [
            ...prev,
            {
              label: pin.name,
              level: "region" as DrillLevel,
              regionSlug: pin.slug,
              countrySlug: pin.country?.slug,
              continentSlug: pin.continent?.slug,
              boundingBoxNE: pin.boundingBoxNE ?? null,
              boundingBoxSW: pin.boundingBoxSW ?? null,
            },
          ])
          fetchPins<GeoMapPin>("areas/map-pins", {
            regionSlug: pin.slug,
            locale,
            status: "published",
          }).then((areaPins) => {
            if (areaPins.length > 0) {
              renderGeoBoundaries(maplibregl, areaPins, "area").then(() =>
                setLoadingRef.current(false)
              )
            } else {
              fetchPins<LibraryMapPin>("libraries/map-pins", {
                regionSlug: pin.slug,
                locale,
                status: "published",
                ...buildFilterQuery(filterParamsRef.current),
              }).then((libPins) => {
                renderLibraryPins(libPins)
                setLoadingRef.current(false)
              })
            }
          })

          break

        default:
          // area
          viewRef.current = {
            ...viewRef.current,
            areaSlug: pin.slug,
            level: "area",
          }
          setBreadcrumbRef.current((prev) => [
            ...prev,
            {
              label: pin.name,
              level: "area" as DrillLevel,
              areaSlug: pin.slug,
              regionSlug: pin.region?.slug,
              countrySlug: pin.country?.slug,
              boundingBoxNE: pin.boundingBoxNE ?? null,
              boundingBoxSW: pin.boundingBoxSW ?? null,
            },
          ])
          fetchPins<LibraryMapPin>("libraries/map-pins", {
            areaSlug: pin.slug,
            locale,
            status: "published",
            ...buildFilterQuery(filterParamsRef.current),
          }).then((libPins) => {
            renderLibraryPins(libPins)
            setLoadingRef.current(false)
          })
      }
    }

    // ── Fetch and render GeoJSON ────────────────────────────────────────────

    const pinsWithBoundary = pins.filter((p) => p.boundaryUrl)
    const pinsWithoutBoundary = pins.filter((p) => !p.boundaryUrl)

    if (pinsWithBoundary.length === 0) {
      // Fallback: render dot markers for all
      for (const pin of pins) {
        if (pin.lat == null || pin.lng == null) continue
        const el = document.createElement("div")
        el.className =
          "w-3 h-3 rounded-full border-2 cursor-pointer transition-transform hover:scale-125"
        el.style.backgroundColor = color
        el.style.borderColor = "rgba(255,255,255,0.5)"
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map)
        el.addEventListener("click", () => drillInto(pin))
        geoMarkersRef.current.push(marker)
      }

      return
    }

    // Fetch all boundary GeoJSON files in parallel
    const featuresBySlug = new Map<
      string,
      GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
    >()

    await Promise.allSettled(
      pinsWithBoundary.map(async (pin) => {
        if (geoGenRef.current !== gen) return
        try {
          const res = await fetch(pin.boundaryUrl!)
          if (!res.ok) return
          const gj = (await res.json()) as
            | GeoJSON.FeatureCollection
            | GeoJSON.Feature
          const features =
            gj.type === "FeatureCollection"
              ? gj.features
              : gj.type === "Feature"
                ? [gj]
                : []
          // Match by slug or name
          for (const f of features) {
            const fSlug =
              (f.properties?.slug as string | undefined) ??
              (f.properties?.name as string | undefined)
                ?.toLowerCase()
                .replaceAll(/\s+/g, "-")
            if (fSlug === pin.slug) {
              featuresBySlug.set(
                pin.slug,
                f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
              )

              return
            }
          }
          // Loose match: single-feature collection
          if (features.length === 1) {
            featuresBySlug.set(
              pin.slug,
              features[0] as GeoJSON.Feature<
                GeoJSON.Polygon | GeoJSON.MultiPolygon
              >
            )
          }
        } catch {
          // ignore
        }
      })
    )

    if (geoGenRef.current !== gen) return

    // Build combined FeatureCollection
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: pins
        .filter((p) => featuresBySlug.has(p.slug))
        .map((p) => ({
          ...featuresBySlug.get(p.slug)!,
          properties: {
            ...featuresBySlug.get(p.slug)?.properties,
            slug: p.slug,
            name: p.name,
            boundingBoxNE: p.boundingBoxNE ?? "",
            boundingBoxSW: p.boundingBoxSW ?? "",
            continentSlug: p.continent?.slug ?? "",
            countrySlug: p.country?.slug ?? "",
            regionSlug: p.region?.slug ?? "",
          },
        })),
    }

    if (!fc.features.length) {
      // All boundary fetches failed — fall back to dot markers
      for (const pin of pins) {
        if (pin.lat == null || pin.lng == null) continue
        const el = document.createElement("div")
        el.className = "w-3 h-3 rounded-full border-2 cursor-pointer"
        el.style.backgroundColor = color
        el.style.borderColor = "rgba(255,255,255,0.5)"
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map)
        el.addEventListener("click", () => drillInto(pin))
        geoMarkersRef.current.push(marker)
      }
      // Add dot markers for pins without boundary
      for (const pin of pinsWithoutBoundary) {
        if (pin.lat == null || pin.lng == null) continue
        const el = document.createElement("div")
        el.className = "w-3 h-3 rounded-full border-2 cursor-pointer"
        el.style.backgroundColor = color
        el.style.borderColor = "rgba(255,255,255,0.5)"
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map)
        el.addEventListener("click", () => drillInto(pin))
        geoMarkersRef.current.push(marker)
      }

      return
    }

    map.addSource("geo-areas", { type: "geojson", data: fc, generateId: true })

    map.addLayer({
      id: "geo-fills",
      type: "fill",
      source: "geo-areas",
      paint: {
        "fill-color": color,
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.22,
          0.1,
        ],
      },
    })

    map.addLayer({
      id: "geo-outlines",
      type: "line",
      source: "geo-areas",
      paint: {
        "line-color": color,
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          2,
          1,
        ],
        "line-opacity": 0.7,
      },
    })

    // Dot markers for pins without boundaries
    for (const pin of pinsWithoutBoundary) {
      if (pin.lat == null || pin.lng == null) continue
      const el = document.createElement("div")
      el.className = "w-3 h-3 rounded-full border-2 cursor-pointer"
      el.style.backgroundColor = color
      el.style.borderColor = "rgba(255,255,255,0.5)"
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map)
      el.addEventListener("click", () => {
        const target = pins.find((p) => p.slug === pin.slug)
        if (target) drillInto(target)
      })
      geoMarkersRef.current.push(marker)
    }

    // ── Hover state ─────────────────────────────────────────────────────────

    let hoveredId: number | string | null = null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("mousemove", "geo-fills", (e: any) => {
      if (!map.getSource("geo-areas")) return
      if (e.features?.length) {
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "geo-areas", id: hoveredId },
            { hover: false }
          )
        }
        hoveredId = e.features[0].id ?? null
        if (hoveredId !== null) {
          map.setFeatureState(
            { source: "geo-areas", id: hoveredId },
            { hover: true }
          )
        }
        map.getCanvas().style.cursor = "pointer"
      }
    })

    map.on("mouseleave", "geo-fills", () => {
      if (!map.getSource("geo-areas")) return
      if (hoveredId !== null) {
        map.setFeatureState(
          { source: "geo-areas", id: hoveredId },
          { hover: false }
        )
        hoveredId = null
      }
      map.getCanvas().style.cursor = ""
    })

    // ── Click to drill down ─────────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("click", "geo-fills", (e: any) => {
      if (!e.features?.length) return
      const props = e.features[0].properties as {
        slug: string
        name: string
        boundingBoxNE?: string
        boundingBoxSW?: string
        continentSlug?: string
        countrySlug?: string
        regionSlug?: string
      }
      const pin = pins.find((p) => p.slug === props.slug)
      if (pin) drillInto(pin)
    })
  }

  // ── Back navigation ────────────────────────────────────────────────────────

  function handleBack() {
    const newCrumb = breadcrumb.slice(0, -1)
    setBreadcrumb(newCrumb)
    setSelectedPin(null)
    setLoading(true)

    const prev = newCrumb.at(-1)

    function applyZoom(entry?: BreadcrumbEntry) {
      const map = mapRef.current
      if (!map) return
      const b = parseBounds(entry?.boundingBoxNE, entry?.boundingBoxSW)
      if (b) {
        map.fitBounds(
          [
            [b.swLng, b.swLat],
            [b.neLng, b.neLat],
          ],
          {
            padding: 60,
            duration: 900,
          }
        )
      } else if (!entry) {
        // Back to world — zoom out
        map.easeTo({ center: [10, 20], zoom: 2, duration: 900 })
      }
    }

    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (!prev) {
        // Back to world — hand off to globe if available, otherwise re-render continents
        viewRef.current = { level: "world" }
        if (onBackToGlobe) {
          setLoading(false)
          onBackToGlobe()

          return
        }
        fetchPins<GeoMapPin>("continents/map-pins", {
          locale,
          status: "published",
        }).then((pins) => {
          const pinsWithBoundaries = pins.map((p) => ({
            ...p,
            boundaryUrl: "/boundaries/world-continents.geojson",
          }))
          renderGeoBoundaries(maplibregl, pinsWithBoundaries, "continent").then(
            () => {
              applyZoom(undefined)
              setLoading(false)
            }
          )
        })

        return
      }

      applyZoom(prev)

      if (prev.level === "area" && prev.regionSlug) {
        viewRef.current = {
          ...viewRef.current,
          level: "region",
          regionSlug: prev.regionSlug,
        }
        fetchPins<GeoMapPin>("areas/map-pins", {
          regionSlug: prev.regionSlug,
          locale,
          status: "published",
        }).then((pins) => {
          renderGeoBoundaries(maplibregl, pins, "area").then(() =>
            setLoading(false)
          )
        })
      } else if (prev.level === "region" && prev.regionSlug) {
        viewRef.current = {
          ...viewRef.current,
          level: "region",
          regionSlug: prev.regionSlug,
        }
        fetchPins<GeoMapPin>("areas/map-pins", {
          regionSlug: prev.regionSlug,
          locale,
          status: "published",
        }).then((areaPins) => {
          if (areaPins.length > 0) {
            renderGeoBoundaries(maplibregl, areaPins, "area").then(() =>
              setLoading(false)
            )
          } else {
            fetchPins<LibraryMapPin>("libraries/map-pins", {
              regionSlug: prev.regionSlug!,
              locale,
              status: "published",
              ...buildFilterQuery(filterParamsRef.current),
            }).then((libPins) => {
              renderLibraryPins(libPins)
              setLoading(false)
            })
          }
        })
      } else if (prev.level === "country" && prev.countrySlug) {
        viewRef.current = {
          ...viewRef.current,
          level: "country",
          countrySlug: prev.countrySlug,
        }
        fetchPins<GeoMapPin>("regions/map-pins", {
          countrySlug: prev.countrySlug,
          locale,
          status: "published",
        }).then((pins) => {
          renderGeoBoundaries(maplibregl, pins, "region").then(() =>
            setLoading(false)
          )
        })
      } else if (prev.level === "continent" && prev.continentSlug) {
        viewRef.current = {
          ...viewRef.current,
          level: "continent",
          continentSlug: prev.continentSlug,
        }
        fetchPins<GeoMapPin>("countries/map-pins", {
          continentSlug: prev.continentSlug,
          locale,
          status: "published",
        }).then((pins) => {
          renderGeoBoundaries(maplibregl, pins, "country").then(() =>
            setLoading(false)
          )
        })
      } else {
        setLoading(false)
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const libraryHref = selectedPin ? buildLibraryHref(selectedPin) : null

  return (
    <div
      className={cn("relative", className)}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Map canvas — inline styles guarantee real pixel dimensions for MapLibre */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Breadcrumb back button */}
      {breadcrumb.length > 0 && (
        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#050816]/80 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md transition-colors hover:border-white/22 hover:text-white"
          >
            ← {breadcrumb.at(-1)?.label ?? "Back"}
          </button>
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      )}

      {/* Selected library pin panel */}
      {selectedPin && (
        <div className="absolute right-3 bottom-3 z-10 w-64 rounded-xl border border-white/12 bg-[#080d1c]/90 p-4 backdrop-blur-md">
          <button
            className="absolute top-2 right-2 rounded p-1 text-white/40 hover:text-white"
            onClick={() => setSelectedPin(null)}
          >
            <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <p className="mb-0.5 text-[10px] font-medium tracking-wider text-white/40 uppercase">
            {selectedPin.libraryType ?? "Library"}
          </p>
          <h3 className="mb-1 pr-4 text-sm leading-snug font-semibold text-white">
            {selectedPin.name}
          </h3>
          {selectedPin.city && (
            <p className="mb-3 text-xs text-white/50">{selectedPin.city}</p>
          )}
          <p className="mb-3 text-xs text-white/40">
            {operationalLabel(selectedPin.operationalStatus)}
          </p>
          {libraryHref && (
            <GlobalLink
              href={libraryHref}
              className="block rounded-lg bg-indigo-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-indigo-500"
            >
              View library →
            </GlobalLink>
          )}
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildFilterQuery(params?: MapFilterParams): Record<string, string> {
  const out: Record<string, string> = {}
  if (params?.libraryTypes?.length) {
    out.libraryTypes = params.libraryTypes.join(",")
  }
  if (params?.operationalStatuses?.length) {
    out.operationalStatuses = params.operationalStatuses.join(",")
  }

  return out
}
