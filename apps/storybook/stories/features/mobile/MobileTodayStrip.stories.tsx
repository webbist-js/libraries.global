import { MobileTodayStrip } from "@/components/mobile/MobileTodayStrip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { timetable } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/MobileTodayStrip",
  component: MobileTodayStrip,
  args: {
    id: "example-mobile",
    tt: timetable,
    notices: [],
    timezone: "Europe/London",
  },
} satisfies Meta<typeof MobileTodayStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
