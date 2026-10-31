import { LibraryDriveNote } from "@/components/library/LibraryDriveNote"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  wizardLibrary,
  libraryPath,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryDriveNote",
  component: LibraryDriveNote,
  args: {
    library: { ...wizardLibrary, href: libraryPath, libraryType: "Public" },
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryDriveNote>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Featured: Story = { args: { featured: true } }
