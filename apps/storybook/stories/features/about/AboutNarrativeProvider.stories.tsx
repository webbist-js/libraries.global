import {
  AboutNarrativeProvider,
  RecordSteps,
} from "@/components/about/AboutChapterControls"
import { createGlobeNarrative } from "@/components/home/knowledge-globe-narrative"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useMemo } from "react"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/About/Narrative controls",
  args: { progress: 2 },
  render: function Example({ progress }) {
    const narrative = useMemo(
      () => createGlobeNarrative({ progress }),
      [progress]
    )

    return (
      <AboutNarrativeProvider narrative={narrative}>
        <RecordSteps />
      </AboutNarrativeProvider>
    )
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<{ progress: number }>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
