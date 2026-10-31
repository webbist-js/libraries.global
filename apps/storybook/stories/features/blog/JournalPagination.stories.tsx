import { DEFAULT_JOURNAL_QUERY } from "@/components/blog/journalLanding.helpers"
import { JournalPagination } from "@/components/blog/JournalPagination"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalPagination",
  component: JournalPagination,
  args: {
    query: DEFAULT_JOURNAL_QUERY,
    page: 2,
    pageCount: 8,
    pageSize: 9,
    total: 71,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalPagination>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SinglePage: Story = { args: { page: 1, pageCount: 1, total: 3 } }
