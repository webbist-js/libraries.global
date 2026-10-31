import { AlreadyInLists } from "@/components/community/AlreadyInLists"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { optionNames } from "../../fixtures/public/community"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Community/AlreadyInLists",
  component: AlreadyInLists,
  args: { optionNames, filter: "all" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof AlreadyInLists>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
