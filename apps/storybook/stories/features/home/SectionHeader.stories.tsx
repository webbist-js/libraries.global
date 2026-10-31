import { SectionHeader } from "@/components/home/sections/SectionHeader"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageContent } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/SectionHeader",
  component: SectionHeader,
  args: {
    intro: homepageContent.featuredIntro,
    action: <a href="/libraries">Browse all libraries</a>,
  },
  decorators: [
    (Story) => (
      <div data-homepage>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof SectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
