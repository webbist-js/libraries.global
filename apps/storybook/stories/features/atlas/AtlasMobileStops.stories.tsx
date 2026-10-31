import { AtlasMobileStops } from "@/components/atlas/AtlasMobileStops"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { stopHit } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasMobileStops",
  component: AtlasMobileStops,
  args: { stops: [stopHit], total: 1, zoomIn: false, onPick: fn() },
} satisfies Meta<typeof AtlasMobileStops>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { stops: [], total: 0 } }
