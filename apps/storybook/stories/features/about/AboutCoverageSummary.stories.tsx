import { AboutCoverageSummary } from "@/components/about/AboutCoverageSummary"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageStats } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/About/AboutCoverageSummary",
  component: AboutCoverageSummary,
  args: { stats: homepageStats },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof AboutCoverageSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
