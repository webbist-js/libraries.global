import { SectionTag } from "@/components/blog/JournalCards"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { articleSection } from "../../fixtures/public/articles"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/SectionTag",
  component: SectionTag,
  args: { section: articleSection },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof SectionTag>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
