import { slugify } from "./text"

export interface SourcePlace {
  key: string
  level: "country" | "region" | "area"
  country: string
  parent?: string
  code: string
  name: string
  names: string[]
  slug: string
  population: number
  method: "direct" | "sum_complete_children"
  coverage?: Record<string, unknown>
  typeLabel?: string
}

export function nameKey(name: string) {
  return slugify(name).replaceAll("-", "")
}
