import { CountryDetailPage } from "@/components/country/CountryDetailPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"
import { countryFixture } from "../../fixtures/geography/locations"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
    react: { rsc: true },
    layout: "fullscreen",
  },
  title: "Features/Country/CountryDetailPage",
  component: CountryDetailPage,
  render: asyncStory(CountryDetailPage),
  args: {
    country: countryFixture,
    locale: "en",
    slug: "example-country",
    continentSlug: "example-continent",
  },
} satisfies Meta<typeof CountryDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
