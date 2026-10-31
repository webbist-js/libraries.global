import { AtlasLoadingSkeleton } from "@/components/atlas/AtlasLoadingSkeleton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasLoadingSkeleton",
  component: AtlasLoadingSkeleton,
  args: { label: "Loading geographic analysis…" },
} satisfies Meta<typeof AtlasLoadingSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
