import { ArticleContext } from "@/components/articles/ArticleContext"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { blogArticle } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Articles/ArticleContext",
  component: ArticleContext,
  args: { article: blogArticle, kind: "journal", locale: "en" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleContext>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
