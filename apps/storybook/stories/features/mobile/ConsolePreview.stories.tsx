import { ConsolePreview } from "@/components/mobile/live/ConsolePreview"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { publicLive, liveSettings } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/ConsolePreview",
  component: ConsolePreview,
  args: {
    initial: liveSettings,
    live: null,
    publicPath: "/libraries/example-mobile",
    firstName: "Maya",
  },
} satisfies Meta<typeof ConsolePreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Live: Story = { args: { live: publicLive } }
