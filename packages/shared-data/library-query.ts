/** The core Library endpoint is for bounded, indexed lookups. Text/facet
 * discovery belongs to the search index, not substring SQL on the catalogue.
 */
const SCALARS = new Set([
  "id",
  "documentId",
  "entityRef",
  "slug",
  "name",
  "locale",
  "publishedAt",
  "completeness",
])
const RELATIONS = new Set([
  "country",
  "region",
  "continent",
  "location",
  "homeLibrary",
  "libraryType",
])
const RELATED = new Set(["id", "documentId", "slug", "name"])
const SORTS = new Set([
  "id",
  "name",
  "completeness",
  "createdAt",
  "updatedAt",
  "documentId",
])
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
const scalar = (value: unknown) =>
  value === null ||
  typeof value === "boolean" ||
  (typeof value === "string" && value.length <= 200) ||
  (typeof value === "number" && Number.isSafeInteger(value))

function fail(): never {
  throw new Error("invalid_library_query")
}
function boundedInteger(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER
) {
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && /^\d+$/.test(value))
  )
    return false
  const number = Number(value)

  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
}
function validateOperator(
  field: string,
  operator: string,
  argument: unknown,
  related: boolean
) {
  if (operator === "$eq" && scalar(argument)) return
  if (
    operator === "$in" &&
    Array.isArray(argument) &&
    argument.length <= 100 &&
    argument.every(scalar)
  )
    return
  if (["$null", "$notNull"].includes(operator) && typeof argument === "boolean")
    return
  if (
    operator === "$gt" &&
    field === "id" &&
    !related &&
    boundedInteger(argument, 0, 2147483647)
  )
    return
  fail()
}
function validateSelection(
  field: string,
  selection: unknown,
  related: boolean
) {
  if (!(related ? RELATED : SCALARS).has(field)) fail()
  if (!object(selection)) {
    if (!scalar(selection)) fail()

    return
  }
  for (const [operator, argument] of Object.entries(selection))
    validateOperator(field, operator, argument, related)
}
function validateFilters(
  value: unknown,
  budget: { nodes: number },
  related = false,
  depth = 0
): void {
  if (!object(value) || depth > 5 || ++budget.nodes > 50) fail()
  for (const [field, selection] of Object.entries(value)) {
    if (["$and", "$or"].includes(field)) {
      if (!Array.isArray(selection) || selection.length > 10) fail()
      for (const item of selection)
        validateFilters(item, budget, related, depth + 1)
    } else if (!related && RELATIONS.has(field))
      validateFilters(selection, budget, true, depth + 1)
    else validateSelection(field, selection, related)
  }
}
function validateSort(input: unknown) {
  const sort = Array.isArray(input) ? input : [input]
  if (sort.length > 3) fail()
  for (const value of sort) {
    if (typeof value !== "string") fail()
    const [field, direction, extra] = value.split(":")
    if (
      extra !== undefined ||
      !SORTS.has(field!) ||
      (direction !== undefined && !["asc", "desc"].includes(direction))
    )
      fail()
  }
}
function validatePagination(input: unknown) {
  const pagination = input ?? { pageSize: 100 }
  if (!object(pagination)) fail()
  for (const [key, value] of Object.entries(pagination)) {
    if (key === "withCount") {
      if (![true, false, "true", "false"].includes(value as boolean)) fail()
    } else if (
      !["page", "pageSize", "start", "limit"].includes(key) ||
      !boundedInteger(value, key === "start" ? 0 : 1)
    )
      fail()
  }
  const offsetMode =
    pagination.start !== undefined || pagination.limit !== undefined
  const pageMode =
    pagination.page !== undefined || pagination.pageSize !== undefined
  if (offsetMode && pageMode) fail()
  const size = Number(pagination.pageSize ?? pagination.limit ?? 100)
  const offset = Number(
    pagination.start ?? (Number(pagination.page ?? 1) - 1) * size
  )
  if (size > 100 || offset > 10_000) fail()

  return pagination
}

export function boundedLibraryQuery(
  input: Record<string, unknown>
): Record<string, unknown> {
  if (input.filters !== undefined) validateFilters(input.filters, { nodes: 0 })
  if (input.sort !== undefined) validateSort(input.sort)
  if (
    input.locale !== undefined &&
    !["en", "fr", "cs"].includes(String(input.locale))
  )
    fail()

  return { ...input, pagination: validatePagination(input.pagination) }
}
