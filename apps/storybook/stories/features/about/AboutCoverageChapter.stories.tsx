import { AboutCoverageChapter } from "@/components/about/AboutCoverageChapter"
import { AboutCoverageSummary } from "@/components/about/AboutCoverageSummary"
import { CoverageSection } from "@/components/home/sections/CoverageSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  homepageStats,
  homepageContinents,
} from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/About/AboutCoverageChapter",
  component: AboutCoverageChapter,
  args: {
    children: (
      <CoverageSection
        intro={{
          title: "Coverage around the world",
          text: "Library records shared by the community.",
        }}
        continents={homepageContinents}
      />
    ),
    footer: <AboutCoverageSummary stats={homepageStats} />,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof AboutCoverageChapter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
