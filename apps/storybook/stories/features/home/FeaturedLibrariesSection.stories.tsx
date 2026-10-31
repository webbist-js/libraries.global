import { FeaturedLibrariesSection } from "@/components/home/sections/FeaturedLibrariesSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  homepageContent,
  homepageStats,
  featuredLibraries,
} from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/FeaturedLibrariesSection",
  component: FeaturedLibrariesSection,
  args: {
    libraries: featuredLibraries,
    intro: homepageContent.featuredIntro,
    total: homepageStats.libraries,
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
} satisfies Meta<typeof FeaturedLibrariesSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
