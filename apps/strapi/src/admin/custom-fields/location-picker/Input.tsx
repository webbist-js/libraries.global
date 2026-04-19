import { Box, Flex, Typography } from "@strapi/design-system"
import { useCallback, useEffect, useRef, useState } from "react"

import type { LocationPickerValue } from "../../../customFields/locationPicker/shared"

// ── Nominatim ─────────────────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

async function searchNominatim(query: string): Promise<NominatimResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", query)
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("limit", "6")
  url.searchParams.set("accept-language", "en")

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "libraries.global admin" },
  })
  if (!res.ok) return []

  return res.json()
}

// ── Leaflet loader (singleton — loads once from unpkg) ────────────────────────

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type LeafletType = typeof import("leaflet")

const loadLeaflet = (() => {
  let promise: Promise<LeafletType> | null = null

  return (): Promise<LeafletType> => {
    if (promise) return promise

    promise = new Promise((resolve, reject) => {
      // CSS
      if (!document.getElementById("leaflet-css-unpkg")) {
        const link = document.createElement("link")
        link.id = "leaflet-css-unpkg"
        link.rel = "stylesheet"
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        document.head.append(link)
      }

      // JS — resolve immediately if already loaded
      if ((window as any).L) {
        resolve((window as any).L as LeafletType)

        return
      }

      const script = document.createElement("script")
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      script.addEventListener("load", () =>
        resolve((window as any).L as LeafletType)
      )
      script.addEventListener("error", reject)
      document.head.append(script)
    })

    return promise
  }
})()

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseValue(raw: unknown): LocationPickerValue | null {
  if (!raw) return null
  if (typeof raw === "object" && raw !== null) return raw as LocationPickerValue
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  return null
}

// ── Inline styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #dcdce4",
  borderRadius: "4px",
  fontSize: "14px",
  color: "#32324d",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
}

const coordInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: "6px 10px",
  fontSize: "13px",
  marginTop: "4px",
}

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 999,
  background: "#fff",
  border: "1px solid #dcdce4",
  borderRadius: "4px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  maxHeight: "260px",
  overflowY: "auto",
}

const resultButtonStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 14px",
  border: "none",
  borderBottom: "1px solid #f0f0ff",
  background: "transparent",
  cursor: "pointer",
  fontSize: "13px",
  lineHeight: "1.5",
  color: "#32324d",
}

// ── Map preview component ─────────────────────────────────────────────────────

function MapPreview({ lat, lng }: { lat: number; lng: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let mounted = true

    loadLeaflet().then((L) => {
      if (!mounted || !containerRef.current) return

      // Initialise map once
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: false,
          scrollWheelZoom: false,
          dragging: true,
        })

        // CartoDB Positron — clean, minimal, light
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          {
            subdomains: "abcd",
            maxZoom: 19,
          }
        ).addTo(mapInstanceRef.current)
      }

      const map = mapInstanceRef.current

      // Update centre
      map.setView([lat, lng], 15, { animate: true })

      // Update marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.circleMarker([lat, lng], {
          radius: 9,
          fillColor: "#4945ff",
          fillOpacity: 1,
          color: "#ffffff",
          weight: 2,
          opacity: 1,
        }).addTo(map)
      }
    })

    return () => {
      mounted = false
    }
  }, [lat, lng])

  // Destroy map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "240px", display: "block" }}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface LocationPickerInputProps {
  value?: unknown
  onChange: (event: {
    target: { name: string; value: LocationPickerValue | null }
  }) => void
  name: string
  disabled?: boolean
}

export default function LocationPickerInput({
  value: rawValue,
  onChange,
  name,
  disabled = false,
}: LocationPickerInputProps) {
  const value = parseValue(rawValue)

  const [search, setSearch] = useState(value?.address ?? "")
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [localLat, setLocalLat] = useState(value?.lat?.toString() ?? "")
  const [localLng, setLocalLng] = useState(value?.lng?.toString() ?? "")

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  const latStr = value?.lat?.toString() ?? ""
  const lngStr = value?.lng?.toString() ?? ""
  useEffect(() => {
    setLocalLat(latStr)
    setLocalLng(lngStr)
  }, [latStr, lngStr])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClick)

    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const emit = useCallback(
    (val: LocationPickerValue | null) => {
      onChange({ target: { name, value: val } })
    },
    [onChange, name]
  )

  // Debounced Nominatim search
  useEffect(() => {
    if (search.length < 3) {
      setResults([])
      setShowResults(false)

      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const data = await searchNominatim(search)
        setResults(data)
        setShowResults(data.length > 0)
      } catch {
        setResults([])
        setShowResults(false)
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => clearTimeout(debounceRef.current)
  }, [search])

  function selectResult(result: NominatimResult) {
    const lat = Number.parseFloat(result.lat)
    const lng = Number.parseFloat(result.lon)
    setLocalLat(String(lat))
    setLocalLng(String(lng))
    setSearch(result.display_name)
    setShowResults(false)
    setResults([])
    emit({ lat, lng, address: result.display_name })
  }

  function handleLatChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setLocalLat(raw)
    const lat = Number.parseFloat(raw)
    if (!Number.isNaN(lat))
      emit({ lat, lng: value?.lng ?? 0, address: value?.address })
  }

  function handleLngChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setLocalLng(raw)
    const lng = Number.parseFloat(raw)
    if (!Number.isNaN(lng))
      emit({ lat: value?.lat ?? 0, lng, address: value?.address })
  }

  function clearLocation() {
    setSearch("")
    setLocalLat("")
    setLocalLng("")
    setResults([])
    setShowResults(false)
    emit(null)
  }

  const hasLocation = value?.lat != null && value?.lng != null

  return (
    <Box ref={containerRef} style={{ position: "relative" }}>
      {/* ── Search ──────────────────────────────────────────────────────── */}
      <Box style={{ position: "relative" }}>
        <Box
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Search for an address or place name…"
            disabled={disabled}
            style={{
              ...inputStyle,
              paddingRight: isSearching ? "36px" : "12px",
            }}
          />
          {isSearching && (
            <span
              style={{
                position: "absolute",
                right: "10px",
                fontSize: "18px",
                color: "#666687",
                animation: "lp-spin 1s linear infinite",
                display: "inline-block",
              }}
            >
              ⟳
            </span>
          )}
        </Box>

        {/* Results dropdown */}
        {showResults && results.length > 0 && (
          <div style={dropdownStyle}>
            {results.map((result) => (
              <button
                key={result.place_id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectResult(result)
                }}
                style={resultButtonStyle}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background =
                    "#f0f0ff"
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background =
                    "transparent"
                }}
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
      </Box>

      {/* ── Coordinates ─────────────────────────────────────────────────── */}
      <Flex gap={2} style={{ marginTop: "12px" }}>
        <Box style={{ flex: 1 }}>
          <Typography variant="pi" textColor="neutral600">
            Latitude
          </Typography>
          <input
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            value={localLat}
            onChange={handleLatChange}
            disabled={disabled}
            placeholder="e.g. 51.5298"
            style={coordInputStyle}
          />
        </Box>

        <Box style={{ flex: 1 }}>
          <Typography variant="pi" textColor="neutral600">
            Longitude
          </Typography>
          <input
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            value={localLng}
            onChange={handleLngChange}
            disabled={disabled}
            placeholder="e.g. -0.1272"
            style={coordInputStyle}
          />
        </Box>

        {hasLocation && (
          <Box style={{ alignSelf: "flex-end", paddingBottom: "2px" }}>
            <button
              type="button"
              onClick={clearLocation}
              disabled={disabled}
              style={{
                padding: "6px 12px",
                border: "1px solid #dcdce4",
                borderRadius: "4px",
                cursor: disabled ? "not-allowed" : "pointer",
                background: "#fff",
                fontSize: "13px",
                color: "#d02b20",
              }}
            >
              Clear
            </button>
          </Box>
        )}
      </Flex>

      {/* ── Map preview ──────────────────────────────────────────────────── */}
      {hasLocation && (
        <Box
          style={{
            marginTop: "16px",
            borderRadius: "8px",
            overflow: "hidden",
            border: "1px solid #dcdce4",
          }}
        >
          <MapPreview lat={value.lat} lng={value.lng} />
          <Box
            padding={3}
            style={{ background: "#f6f6f9", borderTop: "1px solid #dcdce4" }}
          >
            <Typography variant="pi" textColor="neutral600">
              📍{" "}
              {value?.address
                ? value.address
                : `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`}
            </Typography>
          </Box>
        </Box>
      )}

      <style>{`@keyframes lp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Box>
  )
}
