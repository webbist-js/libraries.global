"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import { placeNear } from "@/lib/geocode/client"
import { formatCoord } from "@/lib/geocode/coordinates"
import type { Place } from "@/lib/geocode/place"

import {
  addressIsEmpty,
  applyPlace,
  locationKey,
  withAddress,
} from "./location.apply"
import { resolveHierarchy } from "./location.hierarchy"
import type { FormData } from "./wizard.types"

type HierarchyIds = Pick<
  FormData,
  | "continentDocumentId"
  | "countryDocumentId"
  | "regionDocumentId"
  | "areaDocumentId"
>

const hierarchyKey = (ids: HierarchyIds) =>
  [
    ids.continentDocumentId,
    ids.countryDocumentId,
    ids.regionDocumentId,
    ids.areaDocumentId,
  ].join("|")

export interface LocationFill {
  /** A search result was picked: fill the address, the pin and the atlas. */
  pick: (place: Place) => void
  /** The pin or the device set a point: look up the address there. */
  placeAt: (lat: number, lng: number) => void
  /** Take the offered nearest address. */
  takeAddress: (place: Place) => void
  /** The nearest address to the pin, while the location is as it was. */
  offer: Place | null
  /** The hierarchy selects still hold what a lookup set them to. */
  hierarchyFilled: boolean
  /** The point is a building or an address: the map zooms in close. */
  precise: boolean
}

/**
 * Step 2's lookups: a search pick, a dropped pin and the device's position
 * each fill the form and the atlas hierarchy. Each lookup takes a number,
 * and an answer for an older one is dropped.
 */
export function useLocationFill(
  f: FormData,
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
): LocationFill {
  const latest = useRef(f)
  useEffect(() => {
    latest.current = f
  })
  const run = useRef(0)
  const [offered, setOffered] = useState<{ place: Place; at: string } | null>(
    null
  )
  const [filled, setFilled] = useState<string | null>(null)
  const [precise, setPrecise] = useState(() => !!f.streetAddress.trim())

  const fillHierarchy = useCallback(
    async (place: Place, token: number) => {
      const before = latest.current
      const fill = await resolveHierarchy(before, place.address)
      if (!fill || token !== run.current) return
      setFormData((prev) => ({ ...prev, ...fill }))
      if (hierarchyKey(fill) !== hierarchyKey(before))
        setFilled(hierarchyKey(fill))
    },
    [setFormData]
  )

  const takeAddress = useCallback(
    (place: Place) => {
      const token = ++run.current
      setFormData((prev) => withAddress(prev, place.address))
      setOffered(null)
      void fillHierarchy(place, token)
    },
    [fillHierarchy, setFormData]
  )

  const pick = useCallback(
    (place: Place) => {
      const token = ++run.current
      setFormData((prev) => applyPlace(prev, place))
      setOffered(null)
      setPrecise(place.precise)
      void fillHierarchy(place, token)
    },
    [fillHierarchy, setFormData]
  )

  const placeAt = useCallback(
    (lat: number, lng: number) => {
      const token = ++run.current
      setFormData((prev) => ({
        ...prev,
        lat: formatCoord(lat),
        lng: formatCoord(lng),
      }))
      setOffered(null)
      setPrecise(true)
      // An IIFE, not `.then()`: eslint-plugin-sonarjs's void-use rule
      // only recognises a voided async call or IIFE as intentional.
      void (async () => {
        const place = await placeNear(lat, lng)
        if (!place || token !== run.current) return
        if (addressIsEmpty(latest.current)) takeAddress(place)
        else setOffered({ place, at: locationKey(latest.current) })
      })()
    },
    [setFormData, takeAddress]
  )

  return {
    pick,
    placeAt,
    takeAddress,
    offer: offered && offered.at === locationKey(f) ? offered.place : null,
    hierarchyFilled: filled !== null && filled === hierarchyKey(f),
    precise,
  }
}
