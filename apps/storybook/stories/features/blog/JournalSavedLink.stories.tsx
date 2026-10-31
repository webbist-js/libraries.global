import { DEFAULT_JOURNAL_QUERY } from "@/components/blog/journalLanding.helpers"
import { JournalSavedLink } from "@/components/blog/JournalSaved"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalSavedLink",
  component: JournalSavedLink,
  args: { query: DEFAULT_JOURNAL_QUERY },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalSavedLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
