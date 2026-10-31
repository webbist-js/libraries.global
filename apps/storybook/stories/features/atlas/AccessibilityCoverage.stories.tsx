import { AccessibilityCoverage } from "@/components/atlas/AtlasAccessibility"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AccessibilityCoverage",
  component: AccessibilityCoverage,
  args: {
    coverage: { total: 24, matches: 18, partial: 2, unconfirmed: 4 },
    scope: "Northbridge",
  },
} satisfies Meta<typeof AccessibilityCoverage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unknown: Story = { args: { coverage: null } }
