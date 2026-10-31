import { LeaderboardPeriodNav } from "@/app/[locale]/(dashboard)/community/leaderboard/_components/LeaderboardPeriodNav"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/LeaderboardPeriodNav",
  component: LeaderboardPeriodNav,
  args: { period: "month" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof LeaderboardPeriodNav>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const AllTime: Story = { args: { period: "all" } }
