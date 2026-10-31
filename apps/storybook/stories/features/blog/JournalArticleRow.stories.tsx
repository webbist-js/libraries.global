import { JournalArticleRow } from "@/components/blog/JournalCards"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { journalArticle, articles } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalArticleRow",
  component: JournalArticleRow,
  args: { article: journalArticle, locale: "en" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalArticleRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const DataRelease: Story = {
  args: { article: articles[2]!, dataDrop: true },
}
