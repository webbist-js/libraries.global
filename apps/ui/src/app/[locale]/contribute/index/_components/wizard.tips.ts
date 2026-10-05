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
    title: "Editorial tip",
    body: "Verified librarians submitting from a confirmed institutional address see a fast-track review (avg. ~6 hours instead of 3 days).",
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

/** The tip shown under a step's fields. Improve mode has its own for some steps. */
export function tipFor(step: number, improving: boolean): WizardTip {
  return (improving ? IMPROVE_TIPS[step] : null) ?? TIPS[step] ?? TIPS[1]!
}
