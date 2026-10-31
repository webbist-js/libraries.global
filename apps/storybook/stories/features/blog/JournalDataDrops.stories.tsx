import { JournalDataDrops } from "@/components/blog/JournalDataDrops"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articles } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalDataDrops",
  component: JournalDataDrops,
  args: { articles: [articles[2]!], total: 1, locale: "en" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalDataDrops>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { articles: [], total: 0 } }
