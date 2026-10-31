import { DocsSidebarTree } from "@/components/docs/DocsSidebarTree"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  knowledgeSections,
  knowledgeTree,
} from "../../fixtures/public/knowledge"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Docs/DocsSidebarTree",
  component: DocsSidebarTree,
  args: { sections: knowledgeSections, tree: knowledgeTree },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DocsSidebarTree>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
