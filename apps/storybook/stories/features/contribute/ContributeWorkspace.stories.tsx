import { ContributeWorkspace } from "@/components/contribute/ContributeWorkspace"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/ContributeWorkspace",
  component: ContributeWorkspace,
  args: {
    editor: true,
    userId: "storybook-reader",
    guideHref: "/knowledge/contributing",
    children: (
      <p>
        Choose a record or write a story to improve the public library index.
      </p>
    ),
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ContributeWorkspace>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Reader: Story = { args: { editor: false, userId: undefined } }
