import { LocationLibraryCard } from "@/components/location/LocationLibraryCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/LocationLibraryCard",
  component: LocationLibraryCard,
  args: {
    library: {
      name: "Northbridge Library",
      libraryType: "Public",
      summary: "A welcoming community library.",
      heroImage: { url: "/library-placeholder.svg" },
    },
    href: "/libraries/example",
    place: "Northbridge",
    gaps: ["hours"],
  },
} satisfies Meta<typeof LocationLibraryCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoPhoto: Story = {
  args: { library: { name: "Northbridge Library", libraryType: "Public" } },
}
