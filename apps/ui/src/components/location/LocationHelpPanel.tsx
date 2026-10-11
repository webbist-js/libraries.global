import {
  hubHref,
  type WizardLibrary,
} from "@/components/contribute/wizard.logic"
import { T } from "@/lib/design-tokens"

import { LocationContributionBanner } from "./LocationContributionBanner"

type HelpAction = {
  icon: string
  tintBg: string
  tintFg: string
  title: string
  description: string
  href: string
}

/**
 * The contribution routes a location page offers. On a region page, pass
 * the records with the gaps so the links open the hub on that library, and
 * `propose` to append "Propose a drive for {placeName}".
 */
export function locationHelpActions({
  hoursLibrary,
  photoLibrary,
  propose,
}: {
  hoursLibrary?: WizardLibrary | null
  photoLibrary?: WizardLibrary | null
  /** Appends "Propose a drive for {placeName}", linked to `href`. */
  propose?: { href: string; placeName: string }
} = {}): HelpAction[] {
  const actions: HelpAction[] = [
    {
      icon: "mdi:plus",
      tintBg: T.accent.chip,
      tintFg: T.accent.primary,
      title: "Add a missing library",
      description: "With a website or other source.",
      href: "/contribute/index/new",
    },
    {
      icon: "mdi:clock-outline",
      tintBg: "var(--tint-academic-bg)",
      tintFg: "var(--tint-academic-fg)",
      title: "Fix opening hours",
      description: hoursLibrary
        ? `Start with ${hoursLibrary.name}.`
        : "The detail that goes out of date fastest.",
      href: hubHref("correction", hoursLibrary ?? undefined, "Opening hours"),
    },
    {
      icon: "mdi:camera-outline",
      tintBg: "var(--tint-special-bg)",
      tintFg: "var(--tint-special-fg)",
      title: "Share a photo",
      description: photoLibrary
        ? `${photoLibrary.name} has none yet.`
        : "Your own, or openly licensed.",
      href: hubHref("photo", photoLibrary ?? undefined),
    },
  ]

  if (propose) {
    actions.push({
      icon: "mdi:pin-outline",
      tintBg: T.accent.chip,
      tintFg: T.accent.primary,
      title: `Propose a drive for ${propose.placeName}`,
      description: "Fill one kind of gap across its libraries, together.",
      href: propose.href,
    })
  }

  return actions
}

/** Closing contribution band, shared with Find libraries. */
export function LocationHelpPanel({
  name,
  addHref = "/contribute/index/new",
}: {
  readonly name: string
  readonly body: string
  readonly actions?: HelpAction[]
  readonly addHref?: string
}) {
  return <LocationContributionBanner name={name} addHref={addHref} />
}
