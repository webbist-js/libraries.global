import { AboutGlobeExplorer } from "@/components/about/AboutGlobeExplorer"
import { KnowledgeGlobeCanvas } from "@/components/home/KnowledgeGlobeCanvas"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { aboutCountries } from "../../fixtures/public/about"
import { globeMarkers } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/About/AboutGlobeExplorer",
  component: AboutGlobeExplorer,
  args: {
    enabled: true,
    allowRotation: true,
    countries: aboutCountries,
    markers: globeMarkers,
    children: ({ layer, view }) => (
      <KnowledgeGlobeCanvas
        markers={globeMarkers}
        view={view}
        interactionLayer={layer}
        motionPaused
      />
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ height: 560 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof AboutGlobeExplorer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
