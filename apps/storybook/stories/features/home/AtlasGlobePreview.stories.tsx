import AtlasGlobePreview from "@/components/home/AtlasGlobePreview"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { globeMarkers } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/AtlasGlobePreview",
  component: AtlasGlobePreview,
  args: { markers: globeMarkers, href: "/map" },
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
} satisfies Meta<typeof AtlasGlobePreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
