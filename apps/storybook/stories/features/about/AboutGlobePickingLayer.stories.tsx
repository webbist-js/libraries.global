import { AboutGlobePickingLayer } from "@/components/about/AboutGlobePickingLayer"
import { KnowledgeGlobeCanvas } from "@/components/home/KnowledgeGlobeCanvas"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useRef } from "react"
import { fn } from "storybook/test"

import { aboutCountries, pickingBoundaries } from "../../fixtures/public/about"
import { globeMarkers } from "../../fixtures/public/homepage"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/About/Globe picking layer",
  args: { allowRotation: true },
  render: function Example(args) {
    const ring = useRef<HTMLDivElement>(null),
      tooltip = useRef<HTMLDivElement>(null),
      start = useRef<HTMLDivElement>(null),
      end = useRef<HTMLDivElement>(null),
      connector = useRef<SVGPathElement>(null)

    return (
      <div style={{ height: 560 }}>
        <KnowledgeGlobeCanvas
          markers={globeMarkers}
          view={{ lat: 48, lng: 0 }}
          motionPaused
          interactionLayer={
            <AboutGlobePickingLayer
              {...args}
              countries={aboutCountries}
              boundaries={pickingBoundaries}
              markers={globeMarkers}
              selected={null}
              hover={null}
              projections={{
                ring,
                tooltip,
                endpoints: [start, end],
                connector,
              }}
              onHover={fn()}
              onPin={fn()}
            />
          }
        />
      </div>
    )
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<{ allowRotation: boolean }>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
