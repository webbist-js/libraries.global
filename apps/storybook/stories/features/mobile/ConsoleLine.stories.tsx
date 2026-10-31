import { ConsoleLine } from "@/components/mobile/live/LiveConsoleScreens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/ConsoleLine",
  component: ConsoleLine,
  args: { tone: "status", children: "Next stop: Garden Village at 11:00." },
} satisfies Meta<typeof ConsoleLine>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Alert: Story = {
  args: { tone: "alert", children: "Check the route before setting off." },
}
