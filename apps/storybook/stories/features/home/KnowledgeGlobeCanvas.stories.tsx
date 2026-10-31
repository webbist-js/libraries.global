import { KnowledgeGlobeCanvas } from "@/components/home/KnowledgeGlobeCanvas"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { globeMarkers } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Home/KnowledgeGlobeCanvas",
  component: KnowledgeGlobeCanvas,
  args: {
    markers: globeMarkers,
    motionPaused: true,
    view: { lat: 51.5, lng: -0.1 },
    overrides: { interactive: true },
  },
  decorators: [
    (Story) => (
      <div data-homepage>
        <Story />
      </div>
    ),
    (Story) => (
      <div style={{ position: "relative", height: 560, width: "100%" }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof KnowledgeGlobeCanvas>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
