import { RampLegend } from "@/components/atlas/atlas-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/RampLegend",
  component: RampLegend,
  args: {
    title: "Library density",
    source: "Synthetic data",
    ramp: "seq",
    ticks: ["Low", "Medium", "High"],
  },
} satisfies Meta<typeof RampLegend>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
