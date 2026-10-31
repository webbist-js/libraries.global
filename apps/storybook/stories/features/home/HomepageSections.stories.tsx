import { HomepageSections } from "@/components/home/HomepageSections"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  homepageContent,
  homepageStats,
  homepageContinents,
  featuredLibraries,
  homepageTasks,
  homepageDrives,
  homepageJournal,
  homepageNetworks,
  homepageEvents,
} from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/HomepageSections",
  component: HomepageSections,
  args: {
    content: homepageContent,
    stats: homepageStats,
    tasks: homepageTasks,
    drives: homepageDrives,
    featuredLibraries,
    continents: homepageContinents,
    networks: homepageNetworks,
    events: homepageEvents,
    journal: homepageJournal,
    locale: "en",
    atlasImage: {
      url: "/library-placeholder.svg",
      alternativeText: "Synthetic library illustration",
    },
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
} satisfies Meta<typeof HomepageSections>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
