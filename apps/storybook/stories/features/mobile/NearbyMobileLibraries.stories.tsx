import { NearbyMobileLibraries } from "@/components/mobile/NearbyMobileLibraries"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/NearbyMobileLibraries",
  component: NearbyMobileLibraries,
  args: { lat: 51.5, lng: -0.1, radiusKm: 10, onStops: fn() },
} satisfies Meta<typeof NearbyMobileLibraries>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
