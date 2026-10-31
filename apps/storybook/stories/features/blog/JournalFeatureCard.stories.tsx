import { JournalFeatureCard } from "@/components/blog/JournalCards"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { journalArticle } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalFeatureCard",
  component: JournalFeatureCard,
  args: { article: journalArticle, editorsPick: true, locale: "en" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalFeatureCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
