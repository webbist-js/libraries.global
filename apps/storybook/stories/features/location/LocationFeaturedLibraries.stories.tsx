import { LocationFeaturedLibraries } from "@/components/location/LocationFeaturedLibraries"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"
import { libraryFixture } from "../../fixtures/library"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationFeaturedLibraries",
  component: LocationFeaturedLibraries,
  args: { libraries: [libraryFixture], placeFor: () => "Northbridge" },
} satisfies Meta<typeof LocationFeaturedLibraries>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { libraries: [] } }
