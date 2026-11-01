import { slugify } from "./text"

export function directoryText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = String(value).trim().replaceAll(/\s+/g, " ")
  if (!text || /^(?:-|n\/?a|null|undefined)$/i.test(text)) return undefined

  return text
}

export function directoryUrl(value: unknown): string | undefined {
  const text = directoryText(value)
  if (!text) return undefined
  try {
    const url = new URL(
      /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(text) ? `https://${text}` : text
    )

    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.toString().length <= 255
      ? url.toString()
      : undefined
  } catch {
    return undefined
  }
}

export function directoryPoint(
  lat: unknown,
  lng: unknown,
  bounds: [number, number, number, number]
) {
  if (!directoryText(lat) || !directoryText(lng)) return
  const latitude = Number(lat),
    longitude = Number(lng)
  const [south, north, west, east] = bounds

  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= south &&
    latitude <= north &&
    longitude >= west &&
    longitude <= east
    ? { lat: latitude, lng: longitude }
    : undefined
}

export function directorySlug(name: string, suffix: string, maxLength = 255) {
  const nameLength = Math.min(210, maxLength - suffix.length - 1)
  if (nameLength < 1) throw new Error("Directory slug suffix is too long")

  return `${slugify(name).slice(0, nameLength).replace(/-+$/, "")}-${suffix.toLowerCase()}`
}
