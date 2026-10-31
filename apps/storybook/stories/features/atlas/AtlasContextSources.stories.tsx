import { AtlasContextSources } from "@/components/atlas/AtlasContext"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { contextRelease } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasContextSources",
  component: AtlasContextSources,
  args: { release: contextRelease, open: true },
} satisfies Meta<typeof AtlasContextSources>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
