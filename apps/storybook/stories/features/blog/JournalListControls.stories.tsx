import { DEFAULT_JOURNAL_QUERY } from "@/components/blog/journalLanding.helpers"
import { JournalListControls } from "@/components/blog/JournalListControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalListControls",
  component: JournalListControls,
  args: { query: DEFAULT_JOURNAL_QUERY },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalListControls>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
