import { AboutHero } from "@/components/about/AboutHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { aboutCountries } from "../../fixtures/public/about"
import { globeMarkers } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/About/AboutHero",
  component: AboutHero,
  args: { markers: globeMarkers, countries: aboutCountries },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof AboutHero>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
