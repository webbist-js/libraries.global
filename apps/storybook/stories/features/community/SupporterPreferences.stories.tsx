import { SupporterPreferences } from "@/components/community/SupporterPreferences"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/SupporterPreferences",
  component: SupporterPreferences,
  args: { listed: true, badgeVisible: true, visibility: "public" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof SupporterPreferences>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Private: Story = { args: { visibility: "private" } }
