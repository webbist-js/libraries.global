import { StandingCard } from "@/components/drives/DriveBuilderRail"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Drives/StandingCard",
  component: StandingCard,
  args: { standing: { accepted: 24, open: null } },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof StandingCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ProposalWaiting: Story = {
  args: {
    standing: {
      accepted: 24,
      open: { title: "Opening hours for every library" },
    },
  },
}
