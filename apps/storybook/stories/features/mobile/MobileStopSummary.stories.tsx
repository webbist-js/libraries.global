import { MobileStopSummary } from "@/components/mobile/MobilePlaceStops"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { stopHit } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/MobileStopSummary",
  component: MobileStopSummary,
  args: { hit: stopHit, onSelect: fn() },
} satisfies Meta<typeof MobileStopSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
