import { CoverageExplorer } from "@/components/about/AboutChapterControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { homepageContinents } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/About/CoverageExplorer",
  component: CoverageExplorer,
  args: { continents: homepageContinents, locale: "en" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof CoverageExplorer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
