import { MobileRouteMap } from "@/components/mobile/MobileRouteMap"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { timetable, publicLive } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/MobileRouteMap",
  component: MobileRouteMap,
  args: {
    tt: timetable,
    notices: [],
    timezone: "Europe/London",
    date: "2026-01-15",
    onStop: fn(),
  },
} satisfies Meta<typeof MobileRouteMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
export const Live: Story = { args: { live: publicLive } }
