import { JournalSaveButton } from "@/components/blog/JournalSaved"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { journalArticle } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalSaveButton",
  component: JournalSaveButton,
  args: { documentId: journalArticle.documentId },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalSaveButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
