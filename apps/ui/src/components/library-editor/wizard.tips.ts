export interface WizardTip {
  title: string
  body: string
}

const TIPS: Record<number, WizardTip> = {
  1: {
    title: "Use the library’s own name",
    body: "Enter the name as it appears on the building or the library’s website. Put abbreviations like “BL” in the short name.",
  },
  2: {
    title: "Coordinates matter",
    body: "Without coordinates the library can’t appear on the map. Right-click the entrance in any map app to copy them.",
  },
  3: {
    title: "Only add what you can check",
    body: "Leave hours blank rather than guess. “Hours not added yet” is more useful to visitors than a wrong schedule.",
  },
  4: {
    title: "Approximate is fine",
    body: "Round collection sizes are expected. Include the unit, e.g. “2.4 million volumes” or “170 million items”.",
  },
  5: {
    title: "Founding vs. opening",
    body: "The founding year is when the institution began. The opening year is when the current building opened.",
  },
  6: {
    title: "Credit the photographer",
    body: "Upload only images you took or that carry an open licence, and say which licence in the credit field.",
  },
  7: {
    title: "Work at this library?",
    body: "Once it's published, you can claim it. An approved claim lets you publish changes to its record yourself, from the Staff area.",
  },
  8: {
    title: "Help visitors plan ahead",
    body: "Use the library’s published contact and access information. Include details about vehicle access and services only when you can check them.",
  },
}

const IMPROVE_TIPS: Record<number, WizardTip> = {
  1: {
    title: "Change only what you can source",
    body: "Each changed field is marked. Leave the rest as it is; a reviewer checks every change against your source.",
  },
  7: {
    title: "Say what changed and why",
    body: "A one-line summary and a link to the source speed up review. Changes without a source are usually sent back.",
  },
}

/**
 * Staff editing their own library: no reviewer, so the tips say what
 * happens instead. Each change publishes straight away and is recorded in
 * the public history with its source.
 */
const STAFF_TIPS: Record<number, WizardTip> = {
  1: {
    title: "Change only what you can source",
    body: "Each change publishes straight away and is recorded in the public history with your source. Leave the rest as it is.",
  },
  7: {
    title: "Say what changed and why",
    body: "A one-line summary and a link to the source go into the public history alongside the change. Visitors can see who kept the record accurate.",
  },
}

/**
 * The tip shown under a step's fields. Improve mode has its own for some
 * steps; staff mode (publishing straight away) has its own again.
 */
export function tipFor(
  step: number,
  improving: boolean,
  staff = false,
  mobile = false
): WizardTip {
  if (mobile && step === 3)
    return {
      title: "Use the published timetable",
      body: "Check stop locations and arrival and departure times against the library’s current schedule. Add a timetable link so visitors can check the source.",
    }

  return (
    (staff ? STAFF_TIPS[step] : null) ??
    (improving ? IMPROVE_TIPS[step] : null) ??
    TIPS[step] ??
    TIPS[1]!
  )
}
