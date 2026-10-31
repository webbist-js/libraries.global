import { JournalSidebar } from "@/components/articles/EditorialSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { journalLanding } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Articles/JournalSidebar",
  component: JournalSidebar,
  args: { data: journalLanding },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalSidebar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
