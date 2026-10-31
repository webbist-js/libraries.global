import { TimetableServiceNotices } from "@/components/mobile/TimetableServiceNotices"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/TimetableServiceNotices",
  component: TimetableServiceNotices,
  args: {
    context: { notices: [], timezone: "Europe/London", today: "2026-01-15" },
  },
} satisfies Meta<typeof TimetableServiceNotices>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
