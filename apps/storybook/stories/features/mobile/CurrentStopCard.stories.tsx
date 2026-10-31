import { CurrentStopCard } from "@/components/mobile/live/LiveConsoleScreens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/CurrentStopCard",
  component: CurrentStopCard,
  args: {
    eyebrow: "Current stop",
    name: "Market Square",
    meta: "09:30–10:15 · Beside the community hall",
    primaryLabel: "Leave stop",
    onPrimary: fn(),
  },
} satisfies Meta<typeof CurrentStopCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Busy: Story = { args: { busy: true } }
