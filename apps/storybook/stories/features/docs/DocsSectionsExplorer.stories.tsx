import { DocsSectionsExplorer } from "@/components/docs/DocsSectionsExplorer"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { knowledgeRows } from "../../fixtures/public/knowledge"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Docs/DocsSectionsExplorer",
  component: DocsSectionsExplorer,
  args: { sections: knowledgeRows },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DocsSectionsExplorer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { sections: [] } }
