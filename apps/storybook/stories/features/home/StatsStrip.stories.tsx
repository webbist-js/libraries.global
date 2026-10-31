import { StatsStrip } from "@/components/home/sections/StatsStrip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageStats } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/StatsStrip",
  component: StatsStrip,
  args: { stats: homepageStats },
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
} satisfies Meta<typeof StatsStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Hero: Story = {
  args: { appearance: "hero" },
  decorators: [
    (Story) => (
      <div data-homepage className="home-hero-stats">
        <Story />
      </div>
    ),
  ],
}
