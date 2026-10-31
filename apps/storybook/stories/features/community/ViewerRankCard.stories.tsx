import { ViewerRankCard } from "@/app/[locale]/(dashboard)/community/leaderboard/_components/ViewerRankCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/Routes/ViewerRankCard",
  component: ViewerRankCard,
  args: { initials: "MS", rank: 12, periodPhrase: "this month" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ViewerRankCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unranked: Story = { args: { rank: null } }
