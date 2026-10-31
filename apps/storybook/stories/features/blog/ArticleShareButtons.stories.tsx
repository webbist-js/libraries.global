import { ArticleShareButtons } from "@/components/blog/ArticleShareButtons"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { journalArticle } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/ArticleShareButtons",
  component: ArticleShareButtons,
  args: {
    title: journalArticle.title,
    url: "https://example.invalid/journal/a-reading-room-for-everyone",
    contentId: journalArticle.documentId,
    contentType: "journal",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof ArticleShareButtons>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
