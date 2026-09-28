import type { ActionId } from "./wizard.logic"

export type ActionMeta = {
  id: ActionId
  icon: string
  tintBg: string
  tintFg: string
  title: string
  description: string
  minutes: number
  /** Extra line after the time, e.g. that it leaves the hub. */
  note?: string
}

export const ACTIONS: readonly ActionMeta[] = [
  {
    id: "add",
    icon: "mdi:plus",
    tintBg: "#F5EEDC",
    tintFg: "#6B5420",
    title: "Add a missing library",
    description:
      "A library that isn’t in the index yet, anywhere in the world.",
    minutes: 5,
    note: "Opens the full form",
  },
  {
    id: "correction",
    icon: "mdi:pencil-outline",
    tintBg: "var(--t-accent-chip)",
    tintFg: "var(--t-accent-primary)",
    title: "Suggest a correction",
    description:
      "Opening hours, address, accessibility or anything out of date.",
    minutes: 2,
  },
  {
    id: "photo",
    icon: "mdi:camera-outline",
    tintBg: "var(--tint-public-bg)",
    tintFg: "var(--tint-public-fg)",
    title: "Share a photo",
    description:
      "A photo you took or have permission to share under an open licence.",
    minutes: 3,
  },
  {
    id: "source",
    icon: "mdi:link-variant",
    tintBg: "var(--tint-national-bg)",
    tintFg: "var(--tint-national-fg)",
    title: "Add a source",
    description: "A reference that backs up details already in a record.",
    minutes: 2,
  },
]

export function actionMeta(id: ActionId): ActionMeta {
  return ACTIONS.find((a) => a.id === id)!
}
