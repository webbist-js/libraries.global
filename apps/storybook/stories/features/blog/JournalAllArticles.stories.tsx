import { JournalAllArticles } from "@/components/blog/JournalAllArticles"
import { DEFAULT_JOURNAL_QUERY } from "@/components/blog/journalLanding.helpers"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { journalLanding, discovery } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalAllArticles",
  component: JournalAllArticles,
  args: {
    sections: journalLanding.sections,
    lang: "en",
    query: DEFAULT_JOURNAL_QUERY,
    list: journalLanding.list,
    total: journalLanding.total,
    languages: journalLanding.languages,
    linkLocale: "en",
    fallbackFrom: null,
    discovery,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalAllArticles>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
