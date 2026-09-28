/**
 * Icons for the library page's accessibility & facilities rows. An icon an
 * editor picked in the CMS wins; otherwise the name is matched against the
 * keywords below (first match wins, so specific phrases come before general
 * ones); otherwise the relation kind decides. Every name here is a real
 * Iconify `mdi:` icon.
 */

export type FacilityKind = "accessibility" | "service" | "amenity"

const MATCHERS: [RegExp, string][] = [
  // Mobility
  [/wheelchair/, "mdi:wheelchair"],
  [/step[- ]free|ramp|level access/, "mdi:wheelchair-accessibility"],
  [/bike|bicycle|cycle/, "mdi:bike"],
  [/parking/, "mdi:parking"],
  [/lift|elevator/, "mdi:elevator"],
  [/automatic door|door/, "mdi:door-sliding"],
  [/seat|chair/, "mdi:seat-outline"],
  [/service desk|counter/, "mdi:desk"],
  [/transport|\bbus\b|\brail\b|\btrains?\b/, "mdi:bus"],
  // Facilities
  [/baby|changing/, "mdi:human-baby-changing-table"],
  [/toilet|restroom|\bwc\b/, "mdi:toilet"],
  // Sensory and communication
  [/hearing loop|induction loop/, "mdi:ear-hearing-loop"],
  [/hearing|deaf/, "mdi:ear-hearing"],
  [/braille/, "mdi:braille"],
  [/sign language|\bbsl\b/, "mdi:sign-language"],
  [/dog/, "mdi:dog-service"],
  [/assistive|screen reader/, "mdi:monitor-eye"],
  [/large[- ]print/, "mdi:format-size"],
  [/low vision|magnif/, "mdi:magnify-plus-outline"],
  [/tactile/, "mdi:gesture-tap"],
  [/alarm/, "mdi:alarm-light-outline"],
  // Cognitive
  [/quiet|silent/, "mdi:volume-off"],
  [/neurodiver/, "mdi:brain"],
  [/sensory/, "mdi:tune-variant"],
  [/staff|assistance/, "mdi:account-heart-outline"],
  [/dda|compliant/, "mdi:check-decagram-outline"],
  // Technology
  [/wi-?fi|wireless|internet/, "mdi:wifi"],
  [/computer/, "mdi:desktop-classic"],
  [/3d print|makerspace/, "mdi:printer-3d"],
  [/print/, "mdi:printer-outline"],
  [/photocop|copying/, "mdi:content-copy"],
  [/scan/, "mdi:scanner"],
  [/\bfax\b/, "mdi:fax"],
  [/charg|power/, "mdi:power-plug-outline"],
  // Spaces and comfort
  [/study/, "mdi:desk-lamp"],
  [/bookable|meeting|room/, "mdi:calendar-check-outline"],
  [/garden|outdoor/, "mdi:flower-outline"],
  [/caf[eé]|coffee|restaurant|food/, "mdi:coffee-outline"],
  [/locker/, "mdi:locker"],
  // Services
  [/home library|delivery/, "mdi:truck-delivery-outline"],
  [/digital lending|e-?book|audiobook|e-?magazine/, "mdi:tablet"],
  [/\bbfi\b|film|\btv\b/, "mdi:filmstrip"],
  [/newspaper/, "mdi:newspaper-variant-outline"],
  [/findmypast|family history|genealog/, "mdi:family-tree"],
  [/child|story|rhyme/, "mdi:teddy-bear"],
  [/hobby|group|club/, "mdi:account-group-outline"],
  [/digital skill|online/, "mdi:laptop"],
  [/career|\bjob|\bcv\b/, "mdi:briefcase-outline"],
  [/business|start-up/, "mdi:store-outline"],
  [/exhibit/, "mdi:image-frame"],
  [/archive/, "mdi:archive-outline"],
  [/lending|borrow|book/, "mdi:book-open-page-variant-outline"],
]

const FALLBACK: Record<FacilityKind, string> = {
  accessibility: "mdi:human",
  service: "mdi:room-service-outline",
  amenity: "mdi:star-four-points-outline",
}

/** "mdi:wifi", "lucide:parking"… not bare names or empty strings. */
const ICONIFY_NAME = /^[a-z0-9-]+:[a-z0-9-]+$/

/** The icon a name's keywords point to, or null when none match. */
function keywordIcon(name: string): string | null {
  const text = name.toLowerCase()

  return MATCHERS.find(([pattern]) => pattern.test(text))?.[1] ?? null
}

export function facilityIcon(
  name: string,
  kind: FacilityKind,
  cmsIcon?: string | null
): string {
  if (cmsIcon && ICONIFY_NAME.test(cmsIcon)) return cmsIcon

  return keywordIcon(name) ?? FALLBACK[kind]
}

/** Whether two names describe the same facility ("Café", "Cafes & restaurant"). */
export function sameFacility(a: string, b: string): boolean {
  const icon = keywordIcon(a)

  return icon !== null && icon === keywordIcon(b)
}
