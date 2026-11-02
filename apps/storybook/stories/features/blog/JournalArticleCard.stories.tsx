import { JournalArticleCard } from "@/components/blog/JournalCards"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articleSection, journalArticle } from "../../fixtures/public/articles"
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

export const DataImport: Story = {
  args: {
    article: {
      ...journalArticle,
      publicationOrigin: "index",
      entriesAdded: 3222,
      section: { ...articleSection, slug: "data", name: "Data" },
    },
  },
}

export const DataImportWithoutImage: Story = {
  args: {
    article: {
      ...journalArticle,
      publicationOrigin: "index",
      entriesAdded: 3222,
      section: { ...articleSection, slug: "data", name: "Data" },
      heroImage: null,
    },
  },
}
