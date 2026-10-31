import { LiveSettings } from "@/components/mobile/live/LiveSettings"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { liveSettings, sessionLogs } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/LiveSettings",
  component: LiveSettings,
  args: {
    initial: liveSettings,
    owner: true,
    team: false,
    members: {
      members: [],
      invites: [],
      audit: [],
      canLeave: false,
      covered: false,
      team: null,
    },
    logs: sessionLogs,
    locale: "en",
    consoleUrl: "/staff/example-mobile/live",
    publicPath: "/libraries/example-mobile",
    firstName: "Maya",
  },
} satisfies Meta<typeof LiveSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
