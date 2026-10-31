import { NetworkMandateCard } from "@/components/networks/NetworkMandateCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { networkMandate } from "../../fixtures/public/networks"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/NetworkMandateCard",
  component: NetworkMandateCard,
  args: { mandate: networkMandate, onChanged: fn(), onAdditions: fn() },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof NetworkMandateCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Revoked: Story = {
  args: { mandate: { ...networkMandate, status: "revoked" } },
}
