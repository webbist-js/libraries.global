import { RegionDetailPage } from "@/components/region/RegionDetailPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"
import { regionFixture } from "../../fixtures/geography/locations"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
    react: { rsc: true },
    layout: "fullscreen",
  },
  title: "Features/Region/RegionDetailPage",
  component: RegionDetailPage,
  render: asyncStory(RegionDetailPage),
  args: {
    region: regionFixture,
    locale: "en",
    slug: "northbridge",
    countrySlug: "example-country",
    continentSlug: "example-continent",
    gapCounts: { total: 24, gaps: { hours: 6, photo: 10 } },
  },
} satisfies Meta<typeof RegionDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
