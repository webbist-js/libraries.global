import { HowEditingWorks } from "@/components/contribute/article-editor/ArticleSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/HowEditingWorks",
  component: HowEditingWorks,
  args: { publishesDirectly: false },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof HowEditingWorks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const DirectPublishing: Story = { args: { publishesDirectly: true } }
