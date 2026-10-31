import { LiveStatusStrip } from "@/components/mobile/live/LiveConsoleScreens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/LiveStatusStrip",
  component: LiveStatusStrip,
  args: {
    tone: "ok",
    icon: "mdi:check-circle-outline",
    children: "Live sharing is active.",
  },
} satisfies Meta<typeof LiveStatusStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Delayed: Story = {
  args: { tone: "warn", children: "The service is running 10 minutes late." },
}
