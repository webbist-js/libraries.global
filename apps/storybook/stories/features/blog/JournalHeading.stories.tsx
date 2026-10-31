import { JournalHeading } from "@/components/blog/JournalSectionBrowser"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalHeading",
  component: JournalHeading,
  args: {
    id: "example-journal-heading",
    children: "Stories",
    italic: "from libraries",
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalHeading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
