import { DEFAULT_JOURNAL_QUERY } from "@/components/blog/journalLanding.helpers"
import { JournalSectionBrowser } from "@/components/blog/JournalSectionBrowser"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { journalLanding } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalSectionBrowser",
  component: JournalSectionBrowser,
  args: {
    sections: journalLanding.sections,
    total: journalLanding.total,
    query: DEFAULT_JOURNAL_QUERY,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalSectionBrowser>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
