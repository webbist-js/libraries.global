import { MobilePlaceStops } from "@/components/mobile/MobilePlaceStops"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/MobilePlaceStops",
  component: MobilePlaceStops,
  args: { level: "region", slug: "northbridge", name: "Northbridge" },
} satisfies Meta<typeof MobilePlaceStops>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
