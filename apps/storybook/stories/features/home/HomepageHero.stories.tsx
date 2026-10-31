import { HomepageHero } from "@/components/home/HomepageHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageContent, globeMarkers } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/HomepageHero",
  component: HomepageHero,
  args: {
    eyebrow: homepageContent.heroEyebrow,
    title: homepageContent.heroTitle,
    text: homepageContent.heroText,
    markers: globeMarkers,
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
} satisfies Meta<typeof HomepageHero>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
