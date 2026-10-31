import { LocationAbout } from "@/components/location/LocationAbout"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationAbout",
  component: LocationAbout,
  args: {
    name: "Northbridge",
    about: [
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            text: "Explore community libraries, archives and reading rooms throughout the district.",
          },
        ],
      },
    ],
  },
} satisfies Meta<typeof LocationAbout>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
