"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import type { MapConfig } from "@/lib/strapi-api/content/server"
import { cn } from "@/lib/styles"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LibraryMapPin {
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

export interface GeoMapPin {
  documentId: string
  name: string
  slug: string
  /** Centroid — optional when boundaryUrl is present */
  lat?: number | null
  lng?: number | null
  boundingBoxNE?: string | null
  boundingBoxSW?: string | null
  /** URL to a static GeoJSON file in public/boundaries/ */
  boundaryUrl?: string | null
  continent?: { slug: string } | null
  country?: { slug: string } | null
  region?: { slug: string } | null
}

export type MapDrillLevel = "continent" | "country" | "region" | "area"

interface BreadcrumbEntry {
  label: string
  level: MapDrillLevel
  areaSlug?: string
  regionSlug?: string
  countrySlug?: string
  continentSlug?: string
  /** Bounding box of the level being entered — used to re-fit viewport on back */
  boundingBoxNE?: string | null
  boundingBoxSW?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function operationalLabel(status?: string | null): string {
  switch (status) {
    case "open":
      return "Open"
    case "temporarily_closed":
      return "Temporarily Closed"
    case "permanently_closed":
      return "Permanently Closed"
    case "seasonal":
      return "Seasonal"
    case "appointment_only":
      return "By Appointment"

    default:
      return "Unknown"
  }
}

function buildLibraryHref(pin: LibraryMapPin): string | null {
  const c = pin.continent?.slug
  const co = pin.country?.slug
  const r = pin.region?.slug
  const s = pin.slug
  if (c && co && r && s) return `/${c}/${co}/${r}/${s}`

  return null
}

async function fetchMapPins<T>(
  path: string,
  params: Record<string, string>
): Promise<T[]> {
  const query = new URLSearchParams(params)
  try {
    const res = await fetch(`/api/public-proxy/api/${path}?${query}`)
    if (!res.ok) return []
    const json = (await res.json()) as { data?: T[] }

    return json.data ?? []
  } catch {
    return []
  }
}

function parseBounds(
  ne: string | null | undefined,
  sw: string | null | undefined
) {
  if (!ne || !sw) return null
  const neParts = ne.split(",").map(Number)
  const swParts = sw.split(",").map(Number)
  const neLat = neParts[0],
    neLng = neParts[1]
  const swLat = swParts[0],
    swLng = swParts[1]
  if (
    neLat === undefined ||
    neLng === undefined ||
    swLat === undefined ||
    swLng === undefined ||
    Number.isNaN(neLat) ||
    Number.isNaN(neLng) ||
    Number.isNaN(swLat) ||
    Number.isNaN(swLng)
  )
    return null

  return { neLat, neLng, swLat, swLng } as const
}

// ── Layer ID constants ────────────────────────────────────────────────────────

const LIBRARY_LAYERS = [
  "library-clusters",
  "library-cluster-count",
  "library-pins",
] as const
const LIBRARY_SOURCES = ["libraries"] as const
const GEO_LAYERS = ["geo-fills", "geo-outlines"] as const
const GEO_SOURCES = ["geo-areas"] as const

// ── Component ─────────────────────────────────────────────────────────────────

export interface InteractiveMapProps {
  mapConfig?: MapConfig | null
  mode: MapDrillLevel
  regionSlug?: string
  countrySlug?: string
  continentSlug?: string
  locale?: string
  className?: string
  /** Map height in pixels, defaults to 440. Ignored when fill=true. */
  height?: number
  /** Fill the parent container instead of using a fixed pixel height. */
  fill?: boolean
}

export function InteractiveMap({
  mapConfig,
  mode: initialMode,
  regionSlug,
  countrySlug,
  continentSlug,
  locale = "en",
  className,
  height = 440,
  fill = false,
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // HTML label/dot markers for geo-level items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoMarkersRef = useRef<any[]>([])
  // Generation counter — incremented each time renderGeoPins is called so stale
  // event-handler closures from previous renders exit early.
  const geoGenRef = useRef(0)

  const [mapReady, setMapReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPin, setSelectedPin] = useState<LibraryMapPin | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([])

  // Ref-stable view state so event handlers don't go stale
  const viewRef = useRef<{
    mode: MapDrillLevel
    areaSlug?: string
    regionSlug?: string
    countrySlug?: string
    continentSlug?: string
  }>({
    mode: initialMode,
    regionSlug,
    countrySlug,
    continentSlug,
  })

  // Stable callback refs
  const setSelectedPinRef = useRef(setSelectedPin)
  setSelectedPinRef.current = setSelectedPin
  const setBreadcrumbRef = useRef(setBreadcrumb)
  setBreadcrumbRef.current = setBreadcrumb
  const setLoadingRef = useRef(setLoading)
  setLoadingRef.current = setLoading

  // ── Map initialisation ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return

    let alive = true

    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (!alive || !containerRef.current) return

      const centerLng = mapConfig?.centerLng ?? 0
      const centerLat = mapConfig?.centerLat ?? 20
      const defaultZoom =
        mapConfig?.defaultZoom ??
        (initialMode === "region" ? 9 : initialMode === "country" ? 5 : 3)

      const map = new maplibregl.Map({
        container: containerRef.current,
        // CARTO Dark Matter No Labels — free, no API key, native maplibre-gl, no CORS issues
        style:
          "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json",
        center: [centerLng, centerLat],
        zoom: defaultZoom,
        attributionControl: false,
      })

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      )
      mapRef.current = map

      // Fit to bounding box if provided
      if (mapConfig?.boundingBoxNE && mapConfig?.boundingBoxSW) {
        const b = parseBounds(mapConfig.boundingBoxNE, mapConfig.boundingBoxSW)
        if (b) {
          map.fitBounds(
            [
              [b.swLng, b.swLat],
              [b.neLng, b.neLat],
            ],
            { padding: 48, duration: 0 }
          )
        }
      }

      map.on("load", () => {
        if (alive) setMapReady(true)
      })
    })

    return () => {
      alive = false
      geoMarkersRef.current.forEach((m) => m.remove())
      geoMarkersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear helpers ───────────────────────────────────────────────────────────

  function clearLibraryLayers() {
    const map = mapRef.current
    if (!map) return
    for (const id of LIBRARY_LAYERS) if (map.getLayer(id)) map.removeLayer(id)
    for (const id of LIBRARY_SOURCES)
      if (map.getSource(id)) map.removeSource(id)
  }

  function clearGeoBoundaryLayers() {
    const map = mapRef.current
    if (!map) return
    for (const id of GEO_LAYERS) if (map.getLayer(id)) map.removeLayer(id)
    for (const id of GEO_SOURCES) if (map.getSource(id)) map.removeSource(id)
    geoMarkersRef.current.forEach((m) => m.remove())
    geoMarkersRef.current = []
  }

  // ── Zoom to a geo-pin bounds / centroid ─────────────────────────────────────

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

  // ── Library pins (GeoJSON clustered circles) ─────────────────────────────────

  function renderLibraryPins(pins: LibraryMapPin[]) {
    const map = mapRef.current
    if (!map) return
    clearLibraryLayers()
    clearGeoBoundaryLayers()
    setSelectedPinRef.current(null)

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

    // Cluster circles
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

    // Cluster count label
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

    // Individual pin circles
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

    // Cluster click → zoom in
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

    // Pin click → side panel
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

  // ── Geo-level boundaries (countries / regions) ───────────────────────────────
  // Items with boundaryUrl → fetch GeoJSON at runtime, render fill + outline layers
  // Items without boundary but with centroid → fallback dot marker

  async function renderGeoBoundaries(
    maplibregl: any,
    pins: GeoMapPin[],
    type: "region" | "country" | "area"
  ) {
    const map = mapRef.current
    if (!map) return
    clearLibraryLayers()
    clearGeoBoundaryLayers()
    setSelectedPinRef.current(null)

    const gen = ++geoGenRef.current
    const color =
      type === "country" ? "#22d3ee" : type === "region" ? "#f59e0b" : "#a78bfa"
    const fallbackZoom = type === "country" ? 6 : type === "region" ? 9 : 11

    // ── Shared drill-down handler ─────────────────────────────────────────────

    function drillInto(pin: GeoMapPin) {
      zoomToPin(pin, fallbackZoom)
      setLoadingRef.current(true)

      if (type === "country") {
        viewRef.current = {
          ...viewRef.current,
          mode: "country",
          countrySlug: pin.slug,
        }
        setBreadcrumbRef.current((prev) => [
          ...prev,
          {
            label: pin.name,
            level: "country" as MapDrillLevel,
            countrySlug: pin.slug,
            continentSlug: pin.continent?.slug,
            boundingBoxNE: pin.boundingBoxNE ?? null,
            boundingBoxSW: pin.boundingBoxSW ?? null,
          },
        ])
        fetchMapPins<GeoMapPin>("regions/map-pins", {
          countrySlug: pin.slug,
          locale,
          status: "published",
        }).then((regionPins) => {
          if (regionPins.length > 0) {
            renderGeoBoundaries(maplibregl, regionPins, "region").then(() => {
              setLoadingRef.current(false)
            })
          } else {
            fetchMapPins<LibraryMapPin>("libraries/map-pins", {
              countrySlug: pin.slug,
              locale,
              status: "published",
            }).then((libPins) => renderLibraryPins(libPins))
          }
        })
      } else if (type === "region") {
        viewRef.current = {
          ...viewRef.current,
          mode: "region",
          regionSlug: pin.slug,
        }
        setBreadcrumbRef.current((prev) => [
          ...prev,
          {
            label: pin.name,
            level: "region" as MapDrillLevel,
            regionSlug: pin.slug,
            countrySlug: pin.country?.slug,
            continentSlug: pin.continent?.slug,
            boundingBoxNE: pin.boundingBoxNE ?? null,
            boundingBoxSW: pin.boundingBoxSW ?? null,
          },
        ])
        // Check for areas before falling back to library pins
        fetchMapPins<GeoMapPin>("areas/map-pins", {
          regionSlug: pin.slug,
          locale,
          status: "published",
        }).then((areaPins) => {
          if (areaPins.length > 0) {
            renderGeoBoundaries(maplibregl, areaPins, "area").then(() =>
              setLoadingRef.current(false)
            )
          } else {
            fetchMapPins<LibraryMapPin>("libraries/map-pins", {
              regionSlug: pin.slug,
              locale,
              status: "published",
            }).then((libPins) => {
              setLoadingRef.current(false)
              renderLibraryPins(libPins)
            })
          }
        })
      } else {
        // type === "area"
        viewRef.current = {
          ...viewRef.current,
          mode: "area",
          areaSlug: pin.slug,
        }
        setBreadcrumbRef.current((prev) => [
          ...prev,
          {
            label: pin.name,
            level: "area" as MapDrillLevel,
            areaSlug: pin.slug,
            regionSlug: pin.region?.slug,
            countrySlug: pin.country?.slug,
            boundingBoxNE: pin.boundingBoxNE ?? null,
            boundingBoxSW: pin.boundingBoxSW ?? null,
          },
        ])
        fetchMapPins<LibraryMapPin>("libraries/map-pins", {
          areaSlug: pin.slug,
          locale,
          status: "published",
        }).then((libPins) => {
          setLoadingRef.current(false)
          renderLibraryPins(libPins)
        })
      }
    }

    // ── Boundary fill + outline layers ────────────────────────────────────────

    const withBoundaryUrl = pins.filter((p) => p.boundaryUrl)

    if (withBoundaryUrl.length > 0) {
      // Deduplicate URLs — multiple pins may share the same GeoJSON file
      const uniqueUrls = [
        ...new Set(withBoundaryUrl.map((p) => p.boundaryUrl!)),
      ]
      const pinBySlug = new Map(withBoundaryUrl.map((p) => [p.slug, p]))

      // Fetch all unique boundary files in parallel
      const fetched = await Promise.all(
        uniqueUrls.map(async (url) => {
          try {
            const res = await fetch(url)
            if (!res.ok) return null

            return (await res.json()) as {
              features?: {
                geometry: unknown
                properties?: Record<string, unknown>
              }[]
            }
          } catch {
            return null
          }
        })
      )

      // Guard: exit if a newer renderGeoBoundaries call has started
      if (geoGenRef.current !== gen) return

      // Build name → pin map as fallback (normalised lowercase for loose matching)
      const pinByName = new Map(
        withBoundaryUrl.map((p) => [p.name.toLowerCase(), p])
      )

      // Combine features whose slug (or name) matches one of our pins
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const combinedFeatures: any[] = []
      for (const collection of fetched) {
        if (!collection?.features) continue
        for (const feature of collection.features) {
          const slug = feature.properties?.slug as string | undefined
          const featureName =
            (feature.properties?.name as string | undefined) ?? ""
          // Try slug match first, fall back to name match
          const pin =
            (slug && pinBySlug.get(slug)) ??
            pinByName.get(featureName.toLowerCase()) ??
            null
          if (!pin) continue
          combinedFeatures.push({
            type: "Feature",
            geometry: feature.geometry,
            properties: {
              slug: pin.slug,
              name: pin.name,
              lat: pin.lat ?? null,
              lng: pin.lng ?? null,
              boundingBoxNE: pin.boundingBoxNE ?? null,
              boundingBoxSW: pin.boundingBoxSW ?? null,
              regionSlug: pin.region?.slug ?? null,
              continentSlug: pin.continent?.slug ?? null,
              countrySlug: pin.country?.slug ?? null,
            },
          })
        }
      }

      const featureCollection = {
        type: "FeatureCollection" as const,
        features: combinedFeatures,
      }

      map.addSource("geo-areas", {
        type: "geojson",
        data: featureCollection,
        generateId: true,
      })

      map.addLayer({
        id: "geo-fills",
        type: "fill",
        source: "geo-areas",
        paint: {
          "fill-color": color,
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.28,
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
            2.5,
            1.5,
          ],
          "line-opacity": 0.75,
        },
      })

      // Hover state tracking (generation-guarded)
      let hoveredId: number | null = null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("mousemove", "geo-fills", (e: any) => {
        if (geoGenRef.current !== gen || !map.getSource("geo-areas")) return
        if (e.features?.length) {
          if (hoveredId !== null)
            map.setFeatureState(
              { source: "geo-areas", id: hoveredId },
              { hover: false }
            )
          hoveredId = e.features[0].id as number
          map.setFeatureState(
            { source: "geo-areas", id: hoveredId },
            { hover: true }
          )
          map.getCanvas().style.cursor = "pointer"
        }
      })
      map.on("mouseleave", "geo-fills", () => {
        if (geoGenRef.current !== gen) return
        if (hoveredId !== null && map.getSource("geo-areas")) {
          map.setFeatureState(
            { source: "geo-areas", id: hoveredId },
            { hover: false }
          )
          hoveredId = null
        }
        map.getCanvas().style.cursor = ""
      })

      // Click on boundary → drill down
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", "geo-fills", (e: any) => {
        if (geoGenRef.current !== gen || !e.features?.length) return
        const p = e.features[0].properties as {
          slug: string
          name: string
          lat: number | null
          lng: number | null
          boundingBoxNE: string | null
          boundingBoxSW: string | null
          regionSlug: string | null
          continentSlug: string | null
          countrySlug: string | null
        }
        drillInto({
          documentId: "",
          name: p.name,
          slug: p.slug,
          lat: p.lat,
          lng: p.lng,
          boundingBoxNE: p.boundingBoxNE,
          boundingBoxSW: p.boundingBoxSW,
          region: p.regionSlug ? { slug: p.regionSlug } : null,
          continent: p.continentSlug ? { slug: p.continentSlug } : null,
          country: p.countrySlug ? { slug: p.countrySlug } : null,
        })
      })
    }

    // ── HTML label markers for all items with centroids ───────────────────────
    // Boundary items get a text-only label; items without boundaries get a dot + label.

    const markers = pins
      .filter((p) => p.lat != null && p.lng != null)
      .map((pin) => {
        const hasBoundary = !!pin.boundaryUrl
        const wrap = document.createElement("div")

        if (hasBoundary) {
          // Text-only label — not a click target (boundary fill handles clicks)
          wrap.style.cssText = "pointer-events:none;padding:2px 0;"
          const label = document.createElement("span")
          label.style.cssText =
            "font-size:11px;color:#fff;text-shadow:0 1px 4px rgba(5,8,22,0.95),0 0 8px rgba(5,8,22,0.7);white-space:nowrap;font-family:system-ui,sans-serif;font-weight:600;letter-spacing:0.01em;"
          label.textContent = pin.name ?? ""
          wrap.append(label)
        } else {
          // Dot + label marker — clickable fallback
          wrap.style.cssText =
            "display:flex;flex-direction:column;align-items:center;cursor:pointer;"
          const dot = document.createElement("div")
          dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.3);box-shadow:0 0 8px ${color}66;flex-shrink:0;`
          const label = document.createElement("span")
          label.style.cssText =
            "font-size:10px;color:#fff;text-shadow:0 1px 3px rgba(5,8,22,0.9);margin-top:3px;white-space:nowrap;font-family:system-ui,sans-serif;font-weight:500;pointer-events:none;"
          label.textContent = pin.name ?? ""
          wrap.append(dot)
          wrap.append(label)
          wrap.addEventListener("click", () => {
            if (geoGenRef.current !== gen) return
            drillInto(pin)
          })
        }

        return new maplibregl.Marker({
          element: wrap,
          anchor: hasBoundary ? "center" : "top",
        })
          .setLngLat([pin.lng!, pin.lat!])
          .addTo(map)
      })

    geoMarkersRef.current = markers
  }

  // ── Load initial data once map is ready ─────────────────────────────────────

  useEffect(() => {
    if (!mapReady) return

    const {
      mode,
      regionSlug: rs,
      countrySlug: cs,
      continentSlug: cns,
    } = viewRef.current
    const status = "published"
    setLoading(true)

    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (mode === "region" && rs) {
        fetchMapPins<GeoMapPin>("areas/map-pins", {
          regionSlug: rs,
          locale,
          status,
        }).then((areaPins) => {
          if (areaPins.length > 0) {
            renderGeoBoundaries(maplibregl, areaPins, "area").then(() =>
              setLoading(false)
            )
          } else {
            fetchMapPins<LibraryMapPin>("libraries/map-pins", {
              regionSlug: rs,
              locale,
              status,
            }).then((pins) => {
              renderLibraryPins(pins)
              setLoading(false)
            })
          }
        })
      } else if (mode === "country" && cs) {
        fetchMapPins<GeoMapPin>("regions/map-pins", {
          countrySlug: cs,
          locale,
          status,
        }).then((pins) => {
          if (pins.length > 0) {
            renderGeoBoundaries(maplibregl, pins, "region").then(() =>
              setLoading(false)
            )
          } else {
            fetchMapPins<LibraryMapPin>("libraries/map-pins", {
              countrySlug: cs,
              locale,
              status,
            }).then((libPins) => {
              renderLibraryPins(libPins)
              setLoading(false)
            })
          }
        })
      } else if (mode === "continent" && cns) {
        fetchMapPins<GeoMapPin>("countries/map-pins", {
          continentSlug: cns,
          locale,
          status,
        }).then((pins) => {
          renderGeoBoundaries(maplibregl, pins, "country").then(() =>
            setLoading(false)
          )
        })
      } else {
        setLoading(false)
      }
    })
  }, [mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Back navigation ─────────────────────────────────────────────────────────

  function handleBack() {
    const newCrumb = breadcrumb.slice(0, -1)
    setBreadcrumb(newCrumb)
    setSelectedPin(null)
    setLoading(true)

    const status = "published"
    const prev = newCrumb.at(-1)

    /** Zoom map to prev entry's bbox, or fall back to mapConfig bbox */
    function applyZoom(entry: BreadcrumbEntry | undefined) {
      const map = mapRef.current
      if (!map) return
      const ne = entry?.boundingBoxNE ?? mapConfig?.boundingBoxNE
      const sw = entry?.boundingBoxSW ?? mapConfig?.boundingBoxSW
      const b = parseBounds(ne, sw)
      if (b) {
        map.fitBounds(
          [
            [b.swLng, b.swLat],
            [b.neLng, b.neLat],
          ],
          { padding: 60, duration: 900 }
        )
      }
    }

    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (!prev) {
        viewRef.current = {
          mode: initialMode,
          regionSlug,
          countrySlug,
          continentSlug,
        }
        const {
          mode,
          regionSlug: rs,
          countrySlug: cs,
          continentSlug: cns,
        } = viewRef.current
        if (mode === "region" && rs) {
          fetchMapPins<GeoMapPin>("areas/map-pins", {
            regionSlug: rs,
            locale,
            status,
          }).then((areaPins) => {
            if (areaPins.length > 0) {
              renderGeoBoundaries(maplibregl, areaPins, "area").then(() => {
                applyZoom(undefined)
                setLoading(false)
              })
            } else {
              fetchMapPins<LibraryMapPin>("libraries/map-pins", {
                regionSlug: rs,
                locale,
                status,
              }).then((pins) => {
                renderLibraryPins(pins)
                applyZoom(undefined)
                setLoading(false)
              })
            }
          })
        } else if (mode === "country" && cs) {
          fetchMapPins<GeoMapPin>("regions/map-pins", {
            countrySlug: cs,
            locale,
            status,
          }).then((pins) => {
            renderGeoBoundaries(maplibregl, pins, "region").then(() => {
              applyZoom(undefined)
              setLoading(false)
            })
          })
        } else if (mode === "continent" && cns) {
          fetchMapPins<GeoMapPin>("countries/map-pins", {
            continentSlug: cns,
            locale,
            status,
          }).then((pins) => {
            renderGeoBoundaries(maplibregl, pins, "country").then(() => {
              applyZoom(undefined)
              setLoading(false)
            })
          })
        } else {
          applyZoom(undefined)
          setLoading(false)
        }
      } else if (prev.level === "area" && prev.regionSlug) {
        viewRef.current = {
          ...viewRef.current,
          mode: "region",
          regionSlug: prev.regionSlug,
        }
        fetchMapPins<GeoMapPin>("areas/map-pins", {
          regionSlug: prev.regionSlug,
          locale,
          status,
        }).then((pins) => {
          renderGeoBoundaries(maplibregl, pins, "area").then(() => {
            applyZoom(prev)
            setLoading(false)
          })
        })
      } else if (prev.level === "region" && prev.regionSlug) {
        viewRef.current = {
          ...viewRef.current,
          mode: "region",
          regionSlug: prev.regionSlug,
        }
        fetchMapPins<GeoMapPin>("areas/map-pins", {
          regionSlug: prev.regionSlug,
          locale,
          status,
        }).then((areaPins) => {
          if (areaPins.length > 0) {
            renderGeoBoundaries(maplibregl, areaPins, "area").then(() => {
              applyZoom(prev)
              setLoading(false)
            })
          } else {
            fetchMapPins<LibraryMapPin>("libraries/map-pins", {
              regionSlug: prev.regionSlug!,
              locale,
              status,
            }).then((pins) => {
              renderLibraryPins(pins)
              applyZoom(prev)
              setLoading(false)
            })
          }
        })
      } else if (prev.level === "country" && prev.countrySlug) {
        viewRef.current = {
          ...viewRef.current,
          mode: "country",
          countrySlug: prev.countrySlug,
        }
        fetchMapPins<GeoMapPin>("regions/map-pins", {
          countrySlug: prev.countrySlug,
          locale,
          status,
        }).then((pins) => {
          renderGeoBoundaries(maplibregl, pins, "region").then(() => {
            applyZoom(prev)
            setLoading(false)
          })
        })
      } else if (prev.level === "continent" && prev.continentSlug) {
        viewRef.current = {
          ...viewRef.current,
          mode: "continent",
          continentSlug: prev.continentSlug,
        }
        fetchMapPins<GeoMapPin>("countries/map-pins", {
          continentSlug: prev.continentSlug,
          locale,
          status,
        }).then((pins) => {
          renderGeoBoundaries(maplibregl, pins, "country").then(() => {
            applyZoom(prev)
            setLoading(false)
          })
        })
      } else {
        applyZoom(prev)
        setLoading(false)
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const libraryHref = selectedPin ? buildLibraryHref(selectedPin) : null

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#050816]",
        !fill && "rounded-2xl border border-white/8",
        className
      )}
      style={fill ? { height: "100%" } : { height: `${height}px` }}
    >
      {/* Map canvas */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Inset ring — only in embedded mode */}
      {!fill && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/8 ring-inset" />
      )}

      {/* Loading spinner */}
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : null}

      {/* Back button */}
      {breadcrumb.length > 0 ? (
        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#050816]/80 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md transition-colors hover:border-white/22 hover:text-white"
          >
            ← {breadcrumb.at(-1)?.label ?? "Back"}
          </button>
        </div>
      ) : null}

      {/* Selected library panel */}
      {selectedPin ? (
        <div className="absolute right-12 bottom-3 left-3 z-10 rounded-xl border border-white/10 bg-[#050816]/90 p-4 backdrop-blur-md sm:right-12 sm:left-auto sm:w-72">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="truncate text-sm font-semibold text-white">
                {selectedPin.name}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedPin.libraryType ? (
                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                    {selectedPin.libraryType}
                  </span>
                ) : null}
                {selectedPin.operationalStatus ? (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      selectedPin.operationalStatus === "open"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    )}
                  >
                    {operationalLabel(selectedPin.operationalStatus)}
                  </span>
                ) : null}
              </div>
              {selectedPin.city ? (
                <p className="text-[11px] text-white/40">{selectedPin.city}</p>
              ) : null}
            </div>
            <button
              onClick={() => setSelectedPin(null)}
              className="shrink-0 rounded-lg p-1 text-white/40 transition-colors hover:bg-white/8 hover:text-white/70"
            >
              <Icon icon="mdi:close" className="size-4" />
            </button>
          </div>
          {libraryHref ? (
            <GlobalLink
              href={libraryHref}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-xs font-medium text-white/70 transition-colors hover:border-white/18 hover:bg-white/10 hover:text-white"
            >
              View Library <Icon icon="mdi:arrow-right" className="size-3" />
            </GlobalLink>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default InteractiveMap
