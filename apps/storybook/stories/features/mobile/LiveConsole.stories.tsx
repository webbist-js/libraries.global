import { LiveConsole } from "@/components/mobile/live/LiveConsole"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { liveSettings } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
  },
  title: "Features/Mobile/LiveConsole",
  component: LiveConsole,
  args: {
    initial: liveSettings,
    locale: "en",
    role: "editor",
    canGoLive: true,
  },
} satisfies Meta<typeof LiveConsole>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ReadOnly: Story = { args: { canGoLive: false } }
export const Mobile: Story = { args: { mobileApp: true } }
