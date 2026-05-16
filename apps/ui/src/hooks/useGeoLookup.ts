// apps/ui/src/hooks/useGeoLookup.ts
import { useEffect, useRef } from "react"

import { geocodePlaceName, type GeoResult } from "@/lib/geo-lookup"

interface UseGeoLookupOptions {
  debounceMs?: number
  minLength?: number
}

export function useGeoLookup(
  query: string,
  onResult: (result: GeoResult) => void,
  options: UseGeoLookupOptions = {}
) {
  const { debounceMs = 600, minLength = 3 } = options
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    const q = query.trim()
    if (q.length < minLength) return
    debounce.current = setTimeout(async () => {
      const result = await geocodePlaceName(q)
      if (result) onResult(result)
    }, debounceMs)

    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps
}
