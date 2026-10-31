import { LeaderboardPodium } from "@/app/[locale]/(dashboard)/community/leaderboard/_components/LeaderboardPodium"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { leaderboard } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/LeaderboardPodium",
  component: LeaderboardPodium,
  args: { entries: leaderboard, periodPhrase: "this month" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof LeaderboardPodium>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const OpenSpots: Story = { args: { entries: leaderboard.slice(0, 1) } }
