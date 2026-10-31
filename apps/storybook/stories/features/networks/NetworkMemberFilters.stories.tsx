import { NetworkMemberFilters } from "@/components/networks/NetworkMemberFilters"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { networkDetail } from "../../fixtures/public/networks"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/NetworkMemberFilters",
  component: NetworkMemberFilters,
  args: { data: networkDetail, query: new URLSearchParams() },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof NetworkMemberFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
