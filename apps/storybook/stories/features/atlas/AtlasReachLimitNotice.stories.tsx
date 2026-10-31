import { AtlasReachLimitNotice } from "@/components/atlas/AtlasReachLimitNotice"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasReachLimitNotice",
  component: AtlasReachLimitNotice,
  args: { reason: "area", onZoom: fn(), onSingleLibrary: fn() },
} satisfies Meta<typeof AtlasReachLimitNotice>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Busy: Story = { args: { reason: "busy" } }
