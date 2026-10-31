import { TeamNetworkChoice } from "@/components/networks/TeamNetworkChoice"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/TeamNetworkChoice",
  component: TeamNetworkChoice,
  args: { onChoose: fn() },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof TeamNetworkChoice>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
