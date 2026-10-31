import { LocationHero } from "@/components/location/LocationHero"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationHero",
  component: LocationHero,
  args: {
    title: "Northbridge",
    typeLabel: "Region",
    intro: "Libraries, archives and reading rooms in the district.",
    stats: [{ label: "Libraries", value: "24" }],
  },
} satisfies Meta<typeof LocationHero>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
