import { BlogArticlePage } from "@/components/blog/BlogArticlePage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articles, blogArticle } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/BlogArticlePage",
  component: BlogArticlePage,
  args: { article: blogArticle, related: articles.slice(1), locale: "en" },
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
    },
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    react: { rsc: true },
  },
} satisfies Meta<typeof BlogArticlePage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Missing: Story = { args: { article: null } }

export const WithoutSources: Story = {
  args: { article: { ...blogArticle, sources: [] } },
}
