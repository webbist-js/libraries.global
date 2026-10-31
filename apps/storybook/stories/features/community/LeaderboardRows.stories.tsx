import { LeaderboardRows } from "@/app/[locale]/(dashboard)/community/leaderboard/_components/LeaderboardRows"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { leaderboard } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/LeaderboardRows",
  component: LeaderboardRows,
  args: { entries: leaderboard, youRank: 2 },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof LeaderboardRows>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
