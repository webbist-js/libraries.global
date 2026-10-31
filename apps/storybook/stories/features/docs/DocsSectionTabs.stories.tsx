import { DocsSectionTabs } from "@/components/docs/DocsSectionTabs"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { knowledgeSections } from "../../fixtures/public/knowledge"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Docs/DocsSectionTabs",
  component: DocsSectionTabs,
  args: {
    sections: knowledgeSections,
    counts: { contributing: 2, "library-practice": 0 },
    total: 2,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DocsSectionTabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Pills: Story = { args: { variant: "pills" } }
