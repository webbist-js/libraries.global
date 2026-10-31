import { AtlasInspectFooter } from "@/components/atlas/AtlasInspect"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasInspectFooter",
  component: AtlasInspectFooter,
  args: { children: <button type="button">Show results</button> },
} satisfies Meta<typeof AtlasInspectFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
