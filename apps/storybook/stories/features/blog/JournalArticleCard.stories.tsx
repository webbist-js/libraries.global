import { JournalArticleCard } from "@/components/blog/JournalCards"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { journalArticle } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalArticleCard",
  component: JournalArticleCard,
  args: { article: journalArticle, locale: "en" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalArticleCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
