import { DiscoverySection } from "@/components/home/sections/DiscoverySection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  homepageContinents,
  homepageNetworks,
  homepageEvents,
} from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/DiscoverySection",
  component: DiscoverySection,
  args: {
    continents: homepageContinents,
    networks: homepageNetworks,
    events: homepageEvents,
    locale: "en",
  },
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
} satisfies Meta<typeof DiscoverySection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
