import { LocationHierarchy } from "@/components/location/LocationSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationHierarchy",
  component: LocationHierarchy,
  args: {
    entries: [
      { href: "/europe", label: "Europe", count: 1200 },
      {
        href: "/europe/example-country",
        label: "Example country",
        depth: 1,
        count: 120,
      },
      {
        href: "/europe/example-country/northbridge",
        label: "Northbridge",
        depth: 2,
        count: 24,
        current: true,
      },
    ],
  },
} satisfies Meta<typeof LocationHierarchy>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
