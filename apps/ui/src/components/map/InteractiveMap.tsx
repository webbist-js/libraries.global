"use client"

import { useEffect, useRef, useState } from "react"

import type { MapConfig } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

import { LibraryPinPanel } from "./LibraryPinPanel"
import {
  fetchMapPins,
  GEO_LAYERS,
  GEO_SOURCES,
  LIBRARY_LAYERS,
  LIBRARY_SOURCES,
  parseBounds,
} from "./map.helpers"
import type {
  BreadcrumbEntry,
  GeoMapPin,
  LibraryDetails,
  LibraryMapPin,
  MapDrillLevel,
} from "./map.types"

// Re-export types that external consumers depend on
export type { LibraryMapPin, GeoMapPin, MapDrillLevel }

// ── Component props ───────────────────────────────────────────────────────────

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
  /** Hide the internal breadcrumb back button (e.g. when parent provides its own nav). */
  hideBreadcrumb?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  hideBreadcrumb = false,
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // HTML label/dot markers for geo-level items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoMarkersRef = useRef<any[]>([])
  // Generation counter — incremented each time renderGeoBoundaries is called so
  // stale event-handler closures from previous renders exit early.
  const geoGenRef = useRef(0)

  const [mapReady, setMapReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPin, setSelectedPin] = useState<LibraryMapPin | null>(null)
  const [selectedPinDetails, setSelectedPinDetails] =
    useState<LibraryDetails | null>(null)
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([])

  // Ref-stable view state so event handlers don't go stale
  const viewRef = useRef<{
    mode: MapDrillLevel
    areaSlug?: string
    regionSlug?: string
    countrySlug?: string
    continentSlug?: string
  }>({ mode: initialMode, regionSlug, countrySlug, continentSlug })

  // Stable callback refs
  const setSelectedPinRef = useRef(setSelectedPin)
  setSelectedPinRef.current = setSelectedPin
  const setBreadcrumbRef = useRef(setBreadcrumb)
  setBreadcrumbRef.current = setBreadcrumb
  const setLoadingRef = useRef(setLoading)
  setLoadingRef.current = setLoading

  // ── Map initialisation ────────────────────────────────────────────────────

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

      // v2 is light-only — Voyager's warm tones sit well on the paper palette
      const mapStyle =
        "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json"

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyle,
        center: [centerLng, centerLat],
        zoom: defaultZoom,
        attributionControl: false,
      })

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right"
      )
      mapRef.current = map

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

  // ── Secondary detail fetch on pin select ──────────────────────────────────

  useEffect(() => {
    if (!selectedPin) {
      setSelectedPinDetails(null)

      return
    }
    const p = new URLSearchParams({
      "filters[slug][$eq]": selectedPin.slug,
      status: "published",
      "fields[0]": "foundedYear",
      "fields[1]": "district",
      "fields[2]": "featured",
      "fields[3]": "openingTimes",
      "populate[country][fields][0]": "name",
      "populate[region][fields][0]": "name",
    })
    fetch(`/api/public-proxy/api/libraries?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const lib = data?.data?.[0]
        if (!lib) return
        setSelectedPinDetails({
          foundedYear: lib.foundedYear ?? null,
          district: lib.district ?? null,
          featured: lib.featured ?? null,
          openingTimes: lib.openingTimes ?? null,
          countryName: lib.country?.name ?? null,
          regionName: lib.region?.name ?? null,
        })
      })
      .catch(() => setSelectedPinDetails(null))
  }, [selectedPin?.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Layer management helpers ──────────────────────────────────────────────

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

  // ── Zoom to a geo-pin bounds / centroid ───────────────────────────────────

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

  // ── Library pins (GeoJSON clustered circles) ──────────────────────────────

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
          summary: pin.summary ?? "",
          heroImageUrl: pin.heroImage?.url ?? pin.heroImageUrl ?? "",
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
        "circle-color": "#ffffff",
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
        "circle-opacity": 0.95,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#4338CA",
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
      paint: { "text-color": "#4338CA" },
    })

    map.addLayer({
      id: "library-pins",
      type: "circle",
      source: "libraries",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": 7,
        "circle-color": "#4338CA",
        "circle-opacity": 1,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
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

    // Pin click → side panel + centre map
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
      map.easeTo({
        center: coords,
        zoom: Math.max(map.getZoom(), 14),
        duration: 500,
      })
      setSelectedPinRef.current({
        documentId: p.documentId as string,
        name: p.name as string,
        slug: p.slug as string,
        libraryType: (p.libraryType as string) || null,
        operationalStatus: (p.operationalStatus as string) || null,
        city: (p.city as string) || null,
        summary: (p.summary as string) || null,
        heroImageUrl: (p.heroImageUrl as string) || null,
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

  // ── Geo-level boundaries (countries / regions / areas) ────────────────────
  // Items with boundaryUrl → fetch GeoJSON, render fill + outline layers.
  // Items without boundary but with centroid → fallback dot marker.

  async function renderGeoBoundaries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      type === "country" ? "#4338CA" : type === "region" ? "#4A3F8C" : "#28496E"
    const fallbackZoom = type === "country" ? 6 : type === "region" ? 9 : 11

    // ── Shared drill-down handler ───────────────────────────────────────────

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

    // ── Boundary fill + outline layers ─────────────────────────────────────

    const withBoundaryUrl = pins.filter((p) => p.boundaryUrl)

    if (withBoundaryUrl.length > 0) {
      const uniqueUrls = [
        ...new Set(withBoundaryUrl.map((p) => p.boundaryUrl!)),
      ]
      const pinBySlug = new Map(withBoundaryUrl.map((p) => [p.slug, p]))

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

      if (geoGenRef.current !== gen) return

      const pinByName = new Map(
        withBoundaryUrl.map((p) => [p.name.toLowerCase(), p])
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const combinedFeatures: any[] = []
      for (const collection of fetched) {
        if (!collection?.features) continue
        for (const feature of collection.features) {
          const slug = feature.properties?.slug as string | undefined
          const featureName =
            (feature.properties?.name as string | undefined) ?? ""
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

      map.addSource("geo-areas", {
        type: "geojson",
        data: {
          type: "FeatureCollection" as const,
          features: combinedFeatures,
        },
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

    // ── HTML label markers ─────────────────────────────────────────────────
    // Boundary items get a text-only label; items without boundaries get dot + label.

    const markers = pins
      .filter((p) => p.lat != null && p.lng != null)
      .map((pin) => {
        const hasBoundary = !!pin.boundaryUrl
        const wrap = document.createElement("div")

        if (hasBoundary) {
          wrap.style.cssText = "pointer-events:none;padding:2px 0;"
          const label = document.createElement("span")
          label.style.cssText =
            "font-size:11px;color:#17162B;text-shadow:0 1px 4px rgba(250,248,244,0.95),0 0 8px rgba(250,248,244,0.8);white-space:nowrap;font-family:Figtree,system-ui,sans-serif;font-weight:600;letter-spacing:0.01em;"
          label.textContent = pin.name ?? ""
          wrap.append(label)
        } else {
          wrap.style.cssText =
            "display:flex;flex-direction:column;align-items:center;cursor:pointer;"
          const dot = document.createElement("div")
          dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 1px 4px rgba(23,22,43,0.25);flex-shrink:0;`
          const label = document.createElement("span")
          label.style.cssText =
            "font-size:10px;color:#17162B;text-shadow:0 1px 3px rgba(250,248,244,0.9);margin-top:3px;white-space:nowrap;font-family:Figtree,system-ui,sans-serif;font-weight:500;pointer-events:none;"
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

  // ── Load initial data once map is ready ───────────────────────────────────

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

  // ── Back navigation ───────────────────────────────────────────────────────

  function handleBack() {
    const newCrumb = breadcrumb.slice(0, -1)
    setBreadcrumb(newCrumb)
    setSelectedPin(null)
    setLoading(true)

    const status = "published"
    const prev = newCrumb.at(-1)

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

  // ── Render ────────────────────────────────────────────────────────────────

  const heroImageUrl = formatStrapiMediaUrl(selectedPin?.heroImageUrl) ?? null

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        !fill && "rounded-2xl border border-(--t-border-line)",
        className
      )}
      style={
        fill
          ? { height: "100%", background: "var(--t-bg-space)" }
          : { height: `${height}px`, background: "var(--t-bg-space)" }
      }
    >
      {/* Map canvas */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Inset ring — only in embedded mode */}
      {!fill && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-(--t-border-line) ring-inset" />
      )}

      {/* Loading spinner */}
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : null}

      {/* Back button */}
      {breadcrumb.length > 0 && !hideBreadcrumb ? (
        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-full border border-(--t-border-hi) bg-white/90 px-3 py-1.5 text-xs font-semibold text-(--t-ink-dim) backdrop-blur-md transition-colors hover:bg-white hover:text-(--t-ink-base)"
          >
            ← {breadcrumb.at(-1)?.label ?? "Back"}
          </button>
        </div>
      ) : null}

      {/* Selected library panel */}
      {selectedPin ? (
        <LibraryPinPanel
          pin={selectedPin}
          details={selectedPinDetails}
          heroImageUrl={heroImageUrl}
          onClose={() => {
            setSelectedPin(null)
            setSelectedPinDetails(null)
          }}
        />
      ) : null}
    </div>
  )
}

export default InteractiveMap
