import { AboutExperience } from "@/components/about/AboutExperience"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { aboutCountries, aboutLibraries } from "../../fixtures/public/about"
import {
  homepageStats,
  homepageContinents,
  globeMarkers,
} from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/About/AboutExperience",
  component: AboutExperience,
  args: {
    markers: globeMarkers,
    countries: aboutCountries,
    stats: homepageStats,
    continents: homepageContinents,
    libraries: aboutLibraries,
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof AboutExperience>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
