import { NetworkDirectory } from "@/components/networks/NetworkDirectory"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { networkList } from "../../fixtures/public/networks"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/NetworkDirectory",
  component: NetworkDirectory,
  args: { data: networkList, query: new URLSearchParams() },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof NetworkDirectory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  args: { data: { ...networkList, networks: [], total: 0 } },
}
