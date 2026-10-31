import { BlogArticleCard } from "@/components/blog/BlogArticleCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { blogArticle } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/BlogArticleCard",
  component: BlogArticleCard,
  args: { article: blogArticle, index: 0 },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof BlogArticleCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const MissingImage: Story = {
  args: { article: { ...blogArticle, heroImage: null } },
}
