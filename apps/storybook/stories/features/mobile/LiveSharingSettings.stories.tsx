import { LiveSharingSettings } from "@/components/mobile/live/LiveSharingSettings"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { liveSettings } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/LiveSharingSettings",
  component: LiveSharingSettings,
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
    onNote: fn(),
  },
} satisfies Meta<typeof LiveSharingSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ReadOnly: Story = { args: { owner: false } }
