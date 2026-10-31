import { LibraryAreaSection } from "@/components/library/LibraryArea"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryArea,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryAreaSection",
  component: LibraryAreaSection,
  args: {
    libraryId: completeLibrary.documentId,
    libraryName: completeLibrary.name,
    regionName: "Northbridge",
    area: libraryArea,
  },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryAreaSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unavailable: Story = {
  args: {
    area: {
      neighbours: [],
      neighboursUnavailable: true,
      regionTotal: null,
      withinRadius: null,
      sundays: null,
    },
  },
}
