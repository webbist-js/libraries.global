import { AtlasDataGapNotice } from "@/components/atlas/AtlasDataGapNotice"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

const meta = {
  title: "Features/Atlas/AtlasDataGapNotice",
  component: AtlasDataGapNotice,
  args: {
    gap: {
      id: "population-missing:IE",
      reasons: ["missingPopulation"],
      count: 3,
      details: ["Example County", "Sample District", "Fixture Ward"],
    },
    layer: "Population",
    scope: "Ireland · Regions",
    hidden: false,
    signedIn: true,
    onHide: fn(async () => true),
  },
  parameters: { docs: { story: { inline: false } } },
} satisfies Meta<typeof AtlasDataGapNotice>

export default meta
type Story = StoryObj<typeof meta>

/** Signed in: hiding is saved to Settings → Notifications → Prompts. */
export const Default: Story = {}
/** Signed out: hiding lasts for this visit only. */
export const SignedOut: Story = { args: { signedIn: false } }
/** Explanations hidden: only the details button marks the gap. */
export const Hidden: Story = { args: { hidden: true } }
/** Saving the choice fails: the dialog stays open with an alert. */
export const SaveFails: Story = { args: { onHide: fn(async () => false) } }
