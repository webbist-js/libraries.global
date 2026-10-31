import { FeaturedLibraryCard } from "@/components/library/FeaturedLibraryCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { weeklyHours } from "../fixtures/opening-times"

const meta = {
  title: "Features/Library/FeaturedLibraryCard",
  component: FeaturedLibraryCard,
  args: {
    name: "Northbridge Community Library",
    libraryType: "Public",
    city: "Northbridge",
    countryName: "Example country",
    imageUrl: "/library-placeholder.svg",
    imageAlt: "Illustration of a library",
    href: "/libraries/northbridge",
    index: 0,
    openingTimes: weeklyHours,
    summary:
      "A welcoming library with reading rooms and a local history collection.",
    revealDetails: true,
  },
} satisfies Meta<typeof FeaturedLibraryCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const MissingImage: Story = { args: { imageUrl: null } }
export const LongName: Story = {
  args: {
    name: "Northbridge and District Community Reading Room and Reference Library",
  },
}
