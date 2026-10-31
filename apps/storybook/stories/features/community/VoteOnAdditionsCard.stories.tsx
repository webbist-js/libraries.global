import { VoteOnAdditionsCard } from "@/components/community/VoteOnAdditionsCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { suggestions } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/VoteOnAdditionsCard",
  component: VoteOnAdditionsCard,
  args: { initial: suggestions, signInReturnTo: "/community" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof VoteOnAdditionsCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
