import { NetworkAffiliations } from "@/components/networks/NetworkAffiliations"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { affiliation } from "../../fixtures/public/networks"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/NetworkAffiliations",
  component: NetworkAffiliations,
  args: { affiliations: [affiliation] },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof NetworkAffiliations>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { affiliations: [] } }
