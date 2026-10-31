import { FinishedScreen } from "@/components/mobile/live/LiveConsoleScreens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/FinishedScreen",
  component: FinishedScreen,
  args: {
    title: "Sharing has ended",
    summary: "Two stops completed.",
    note: "Visitors can still see the published timetable.",
    backHref: "/staff",
    backLabel: "Back to staff area",
  },
} satisfies Meta<typeof FinishedScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
