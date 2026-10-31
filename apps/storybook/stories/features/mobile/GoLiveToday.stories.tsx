import { GoLiveToday } from "@/components/mobile/live/GoLiveToday"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { liveSettings } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/GoLiveToday",
  component: GoLiveToday,
  args: {
    initial: liveSettings,
    live: null,
    locale: "en",
    consoleUrl: "/staff/example-mobile/live",
    today: "2026-01-15",
  },
} satisfies Meta<typeof GoLiveToday>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
