import { NetworkCountryFilter } from "@/components/networks/NetworkCountryFilter"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { networkList } from "../../fixtures/public/networks"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/NetworkCountryFilter",
  component: NetworkCountryFilter,
  args: { initial: "", countries: networkList.countries! },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof NetworkCountryFilter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Locked: Story = { args: { locked: true } }
