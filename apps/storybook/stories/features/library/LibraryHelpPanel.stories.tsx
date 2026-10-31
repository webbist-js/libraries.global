import { LibraryHelpPanel } from "@/components/library/LibraryHelpPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryHelpPanel",
  component: LibraryHelpPanel,
  args: {
    gaps: ["hours", "photo"],
    librarySlug: completeLibrary.slug,
    libraryName: completeLibrary.name,
    libraryDocumentId: completeLibrary.documentId,
    facilityQuestions: 4,
    showDrive: false,
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryHelpPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Translation: Story = {
  args: {
    gaps: [],
    facilityQuestions: 0,
    translateLocales: [
      { code: "fr", name: "French" },
      { code: "de", name: "German" },
    ],
  },
}
