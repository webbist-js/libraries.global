import { ResultGroup, ResultRow } from "@/components/atlas/AtlasSearchResults"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/ResultGroup",
  component: ResultGroup,
  args: {
    title: "Libraries",
    children: (
      <ResultRow
        title="Northbridge Library"
        sub="Public library · Northbridge"
        onClick={fn()}
      />
    ),
  },
} satisfies Meta<typeof ResultGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
