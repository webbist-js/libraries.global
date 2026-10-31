import { TopThisMonthCard } from "@/components/community/TopThisMonthCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { leaderboard } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/TopThisMonthCard",
  component: TopThisMonthCard,
  args: { entries: leaderboard },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof TopThisMonthCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { entries: [] } }
