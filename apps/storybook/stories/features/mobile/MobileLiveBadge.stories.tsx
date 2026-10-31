import { MobileLiveBadge } from "@/components/mobile/MobileLiveBadge"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { timetable } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/MobileLiveBadge",
  component: MobileLiveBadge,
  args: {
    id: "example-mobile",
    tt: timetable,
    notices: [],
    timezone: "Europe/London",
  },
} satisfies Meta<typeof MobileLiveBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
