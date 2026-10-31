import { LocationSectionHeading } from "@/components/location/LocationHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationSectionHeading",
  component: LocationSectionHeading,
  args: {
    title: "Libraries in Northbridge",
    description: "Find a place to read, learn and meet.",
    count: "24",
  },
} satisfies Meta<typeof LocationSectionHeading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
