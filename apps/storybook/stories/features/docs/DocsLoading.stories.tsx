import { DocsLoading } from "@/components/docs/DocsLoading"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Docs/DocsLoading",
  component: DocsLoading,
  args: {},
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof DocsLoading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Article: Story = { args: { article: true } }
