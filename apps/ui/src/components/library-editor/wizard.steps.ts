export const WIZARD_STEPS = [
  { n: 0, label: "Find existing", sub: "Add or improve" },
  { n: 1, label: "Identity", sub: "Name · Type · Status" },
  { n: 2, label: "Location", sub: "Address · Coordinates" },
  { n: 3, label: "Visit", sub: "Links · Hours · Access" },
  { n: 4, label: "Collections", sub: "Holdings · Classification" },
  { n: 5, label: "History", sub: "Founding · Building" },
  { n: 6, label: "Photo", sub: "Image · Credit" },
  { n: 7, label: "Sources & send", sub: "Evidence · Review" },
] as const

const MOBILE_VISIT_STEP = {
  n: 8,
  label: "Visit & access",
  sub: "Links · Contact · Access",
} as const

/** Stable step IDs; mobile Visit & access follows Stops & times. */
export function wizardSteps(mobile = false) {
  return mobile
    ? [...WIZARD_STEPS.slice(0, 4), MOBILE_VISIT_STEP, ...WIZARD_STEPS.slice(4)]
    : WIZARD_STEPS
}

/** Display position, independent of the stable ID stored with a draft. */
export function wizardStepPosition(n: number, mobile = false) {
  return wizardSteps(mobile).findIndex((step) => step.n === n)
}

export function nextWizardStep(n: number, mobile = false) {
  const steps = wizardSteps(mobile)
  const position = wizardStepPosition(n, mobile)

  return steps[Math.min(Math.max(position + 1, 1), steps.length - 1)]!.n
}

/** Step 7 for staff, who publish rather than send for review. */
const STAFF_LAST_STEP = {
  label: "Sources & publish",
  sub: "Evidence · Publish",
}

/** Shared wording for the rail, Next button and publish summary. */
export function wizardStepCopy(n: number, mobile = false, staff = false) {
  if (mobile && n === 2)
    return { label: "Base & area", sub: "Home base · Areas served" }
  if (mobile && n === 3)
    return { label: "Stops & times", sub: "Timetable · Notices" }
  if (mobile && n === 8) return MOBILE_VISIT_STEP
  if (staff && n === 7) return STAFF_LAST_STEP

  return WIZARD_STEPS.find((step) => step.n === n) ?? WIZARD_STEPS[1]
}

/**
 * `?step=` aliases (`edit?step=hours`): a step's name from `WIZARD_STEPS`,
 * or a field group it holds, maps to its stable ID.
 */
const STEP_ALIASES: Record<string, number> = {
  identity: 1,
  name: 1,
  type: 1,
  status: 1,
  location: 2,
  address: 2,
  coordinates: 2,
  visit: 3,
  hours: 3,
  links: 3,
  access: 3,
  accessibility: 3,
  facilities: 3,
  stops: 3,
  timetable: 3,
  collections: 4,
  history: 5,
  building: 5,
  photo: 6,
  image: 6,
  sources: 7,
}

/** The wizard step a `?step=` value names, or undefined for anything else. */
export function wizardStepOf(
  value: string | undefined,
  mobile = false
): number | undefined {
  if (!value) return undefined
  const key = value.trim().toLowerCase()
  if (/^[1-7]$/.test(key) || (mobile && key === "8")) return Number(key)

  if (
    mobile &&
    ["visit", "links", "access", "accessibility", "facilities"].includes(key)
  )
    return MOBILE_VISIT_STEP.n

  return STEP_ALIASES[key]
}
