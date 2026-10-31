import { LibraryFacilitiesSection } from "@/components/library/LibrarySections"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryPath,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"
import { libraryFixture } from "../../fixtures/library"

const meta = {
  title: "Features/Library/LibraryFacilitiesSection",
  component: LibraryFacilitiesSection,
  args: { library: completeLibrary, path: libraryPath },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryFacilitiesSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unanswered: Story = { args: { library: libraryFixture } }
