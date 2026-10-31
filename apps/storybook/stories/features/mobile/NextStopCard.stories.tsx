import { NextStopCard } from "@/components/mobile/live/LiveConsoleScreens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/NextStopCard",
  component: NextStopCard,
  args: {
    name: "Garden Village",
    time: "11:00–11:45",
    actionLabel: "Arrive at stop",
    onAction: fn(),
  },
} satisfies Meta<typeof NextStopCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
