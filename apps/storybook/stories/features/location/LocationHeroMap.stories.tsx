import { LocationHeroMap } from "@/components/location/LocationHeroMap"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
  },
  title: "Features/Location/LocationHeroMap",
  component: LocationHeroMap,
  args: {
    label: "Libraries in Northbridge",
    caption: "Synthetic map data for the component preview.",
    pins: [
      {
        id: "example-library",
        name: "Northbridge Library",
        href: "/libraries/example",
        lat: 51.5,
        lng: -0.1,
        libraryType: "Public",
      },
    ],
  },
} satisfies Meta<typeof LocationHeroMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
