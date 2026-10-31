import { NetworkLibraryList } from "@/components/networks/NetworkLibraryList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { networkDetail } from "../../fixtures/public/networks"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Networks/NetworkLibraryList",
  component: NetworkLibraryList,
  args: { data: networkDetail },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof NetworkLibraryList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
