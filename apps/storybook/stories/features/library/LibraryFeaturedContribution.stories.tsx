import { LibraryFeaturedContribution } from "@/components/library/LibraryFeaturedContribution"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  wizardLibrary,
  libraryPath,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryFeaturedContribution",
  component: LibraryFeaturedContribution,
  args: {
    library: { ...wizardLibrary, libraryType: "Public" },
    unanswered: 4,
    hasHours: false,
    hasPhoto: false,
    path: libraryPath,
    gaps: ["hours", "photo"],
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryFeaturedContribution>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const HoursDocumented: Story = { args: { hasHours: true } }
export const Mobile: Story = {
  args: {
    library: { ...wizardLibrary, libraryType: "Mobile" },
    hasHours: false,
  },
}
