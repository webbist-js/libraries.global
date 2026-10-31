import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articleBody } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/ArticleBodyBlocks",
  component: ArticleBodyBlocks,
  args: { blocks: articleBody },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleBodyBlocks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { blocks: [] } }
