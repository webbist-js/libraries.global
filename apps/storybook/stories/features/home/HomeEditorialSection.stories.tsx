import { HomeEditorialSection } from "@/components/home/sections/HomeEditorialSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  homepageContent,
  homepageJournal,
} from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/HomeEditorialSection",
  component: HomeEditorialSection,
  args: {
    intro: homepageContent.journalIntro,
    stories: homepageJournal,
    links: homepageContent.knowledgeLinks,
    locale: "en",
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
} satisfies Meta<typeof HomeEditorialSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
