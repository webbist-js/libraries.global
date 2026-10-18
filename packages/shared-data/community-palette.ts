/** Stable profile choices; visual values live in the shared design-system palette. */
const choices = [
  { key: "violet", label: "Violet", hue: 285 },
  { key: "coral", label: "Coral", hue: 25 },
  { key: "mint", label: "Mint", hue: 155 },
  { key: "amber", label: "Amber", hue: 75 },
  { key: "blue", label: "Blue", hue: 220 },
  { key: "rose", label: "Rose", hue: 330 },
] as const

export type ProfileBackground = (typeof choices)[number]["key"]

export const COMMUNITY_PALETTE = choices.map((choice) => ({
  ...choice,
  bg: `var(--t-palette-${choice.key}-bg)`,
  fg: `var(--t-palette-${choice.key}-fg)`,
  soft: `var(--t-palette-${choice.key}-soft)`,
}))

export function isProfileBackground(
  value: unknown
): value is ProfileBackground {
  return (
    typeof value === "string" &&
    COMMUNITY_PALETTE.some((choice) => choice.key === value)
  )
}

export function profilePalette(value?: string | null) {
  return (
    COMMUNITY_PALETTE.find((choice) => choice.key === value) ??
    COMMUNITY_PALETTE[0]!
  )
}
