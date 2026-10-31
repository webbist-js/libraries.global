import { StaffLibraryEntry } from "@/components/library/StaffLibraryEntry"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/StaffLibraryEntry",
  component: StaffLibraryEntry,
  args: {
    libraryDocumentId: completeLibrary.documentId,
    librarySlug: completeLibrary.slug,
    libraryName: completeLibrary.name,
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof StaffLibraryEntry>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
