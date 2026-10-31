import { LocationPinMap } from "@/components/library-editor/LocationPinMap"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/LocationPinMap",
  component: LocationPinMap,
  args: { lat: "51.5", lng: "-0.1", precise: true, onMove: fn() },
} satisfies Meta<typeof LocationPinMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unplaced: Story = { args: { lat: "", lng: "", precise: false } }
