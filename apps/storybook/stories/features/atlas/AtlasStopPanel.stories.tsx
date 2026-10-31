import { AtlasStopPanel } from "@/components/atlas/AtlasStopPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { stopHit, publicLive } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasStopPanel",
  component: AtlasStopPanel,
  args: {
    stop: stopHit,
    live: publicLive,
    now: new Date("2026-01-15T12:00:00Z"),
    onClose: fn(),
  },
} satisfies Meta<typeof AtlasStopPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
