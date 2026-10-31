import { LocationEmptyState } from "@/components/location/LocationHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationEmptyState",
  component: LocationEmptyState,
  args: { name: "Northbridge" },
} satisfies Meta<typeof LocationEmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
