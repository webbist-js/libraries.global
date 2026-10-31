import { BlogArticleGrid } from "@/components/blog/BlogArticleGrid"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articles } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/BlogArticleGrid",
  component: BlogArticleGrid,
  args: { articles, page: 1, pageCount: 3, baseUrl: "/journal" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof BlogArticleGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { articles: [] } }
