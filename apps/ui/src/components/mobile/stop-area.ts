import { resolveHierarchy } from "@/app/[locale]/contribute/index/_components/location.hierarchy"
import { EMPTY_FORM } from "@/app/[locale]/contribute/index/_components/wizard.types"
import { placeNear } from "@/lib/geocode/client"
import type { Place } from "@/lib/geocode/place"

/** Reuse the Location step's country, region and area matching for a stop pin. */
export async function areaAtStop(
  lat: number,
  lng: number,
  knownPlace?: Place
): Promise<{ documentId: string; name: string } | null> {
  const place = knownPlace ?? (await placeNear(lat, lng))
  if (!place) return null
  const hierarchy = await resolveHierarchy(EMPTY_FORM, place.address)
  if (!hierarchy?.areaDocumentId) return null
  try {
    const response = await fetch(
      `/api/relations/areas?regionDocumentId=${encodeURIComponent(hierarchy.regionDocumentId)}`
    )
    const body = (await response.json()) as {
      data?: { documentId: string; name: string }[]
    }
    const area = body.data?.find(
      (a) => a.documentId === hierarchy.areaDocumentId
    )

    return {
      documentId: hierarchy.areaDocumentId,
      name: area?.name ?? "Mapped area",
    }
  } catch {
    return { documentId: hierarchy.areaDocumentId, name: "Mapped area" }
  }
}
