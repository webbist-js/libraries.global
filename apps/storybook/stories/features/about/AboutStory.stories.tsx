import { AboutStory } from "@/components/about/AboutStory"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { aboutLibraries } from "../../fixtures/public/about"
import {
  homepageStats,
  homepageContinents,
} from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/About/AboutStory",
  component: AboutStory,
  args: {
    stats: homepageStats,
    continents: homepageContinents,
    libraries: aboutLibraries,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof AboutStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
