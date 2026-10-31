import { NearestStopFinder } from "@/components/mobile/NearestStopFinder"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { timetable } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/NearestStopFinder",
  component: NearestStopFinder,
  args: { stops: timetable.stops, onSelect: fn() },
} satisfies Meta<typeof NearestStopFinder>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { stops: [] } }
