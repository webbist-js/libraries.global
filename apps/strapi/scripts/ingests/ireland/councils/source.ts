import type { IrishFeed } from "./feeds"
import type { IrishFeature } from "./map"
import type { JsonSources } from "../../_shared/json-source"

interface IrishCatalogue {
  success?: boolean
  result?: {
    name?: string
    license_id?: string
    resources?: { url?: string }[]
    metadata_modified?: string
  }
}
interface IrishFeatureResponse {
  error?: unknown
  exceededTransferLimit?: boolean
  features?: IrishFeature[]
  spatialReference?: { wkid?: number }
  geometryType?: string
  objectIdFieldName?: string
}

export function validateIrishCatalogue(data: IrishCatalogue, feed: IrishFeed) {
  if (
    !data?.success ||
    data.result?.name !== feed.catalogue ||
    data.result?.license_id !== "CC-BY-4.0" ||
    !data.result.resources?.some((r) => r.url === feed.service)
  )
    throw new Error(
      `Licence or resource changed for ${feed.key}; review before importing`
    )
}

export function validateIrishFeatures(
  data: IrishFeatureResponse,
  ids: number[],
  feed: IrishFeed
) {
  if (
    data?.error ||
    data?.exceededTransferLimit ||
    !Array.isArray(data?.features) ||
    data.spatialReference?.wkid !== 4326 ||
    data.geometryType !== "esriGeometryPoint"
  )
    throw new Error(`Invalid or truncated WGS84 point feed: ${feed.key}`)
  const objectField = data.objectIdFieldName
  if (!objectField) throw new Error("Missing object ID field")
  const returned = data.features.map((f) => f.attributes?.[objectField])
  if (
    ids.length !== feed.expected ||
    returned.length !== ids.length ||
    new Set(returned).size !== returned.length ||
    returned.some((id) => typeof id !== "number" || !ids.includes(id))
  )
    throw new Error(
      `Coverage changed for ${feed.key}; review expected count ${feed.expected}`
    )
  const stable = data.features.map((f) => f.attributes?.[feed.idField])
  if (
    stable.some((id: unknown) => typeof id !== "string" || !id.trim()) ||
    new Set(stable).size !== stable.length
  )
    throw new Error(
      `Missing or duplicate stable branch identifiers: ${feed.key}`
    )

  return data.features
}

export async function readIrishFeed(sources: JsonSources, feed: IrishFeed) {
  const catalogue = await sources.read<IrishCatalogue>(
    `${feed.key}-licence`,
    `https://data.gov.ie/api/3/action/package_show?id=${feed.catalogue}`
  )
  validateIrishCatalogue(catalogue.data, feed)
  const ids = await sources.read<{ objectIds?: number[] }>(
    `${feed.key}-ids`,
    `${feed.service}/query?where=1%3D1&returnIdsOnly=true&f=json`
  )
  const objectIds = ids.data?.objectIds
  if (
    !Array.isArray(objectIds) ||
    objectIds.some((id) => !Number.isSafeInteger(id)) ||
    new Set(objectIds).size !== objectIds.length
  )
    throw new Error(`Invalid object IDs: ${feed.key}`)
  // These reviewed feeds each contain fewer than 100 rows. Request all and
  // reconcile against the independent ID inventory; never accept truncation.
  const snapshot = await sources.read<IrishFeatureResponse>(
    `${feed.key}-libraries`,
    `${feed.service}/query?where=1%3D1&outFields=*&outSR=4326&f=json`
  )

  return {
    rows: validateIrishFeatures(snapshot.data, objectIds, feed),
    retrievedAt: snapshot.retrievedAt,
    metadataModified: catalogue.data.result?.metadata_modified,
  }
}
