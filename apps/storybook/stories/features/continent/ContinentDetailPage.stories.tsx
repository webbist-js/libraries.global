import { ContinentDetailPage } from "@/components/continent/ContinentDetailPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"
import { continentFixture } from "../../fixtures/geography/locations"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
    react: { rsc: true },
    layout: "fullscreen",
  },
  title: "Features/Continent/ContinentDetailPage",
  component: ContinentDetailPage,
  render: asyncStory(ContinentDetailPage),
  args: {
    continent: continentFixture,
    locale: "en",
    slug: "example-continent",
  },
} satisfies Meta<typeof ContinentDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Missing: Story = { args: { continent: null } }
