import { AreaDetails } from "@/components/atlas/AtlasAccessViews"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { accessResponse } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AreaDetails",
  component: AreaDetails,
  args: { area: accessResponse.areas[0]!, metric: "per100k", onFit: fn() },
} satisfies Meta<typeof AreaDetails>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
