import { JournalToolbar } from "@/components/blog/JournalToolbar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { journalLanding } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalToolbar",
  component: JournalToolbar,
  args: { data: journalLanding },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
