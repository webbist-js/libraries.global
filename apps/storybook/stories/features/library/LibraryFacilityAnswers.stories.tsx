import { facilityRows } from "@/components/library/facility-rows"
import { LibraryFacilityAnswers } from "@/components/library/LibraryFacilityAnswers"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { readerSession } from "../../../.storybook/FixtureSession"
import {
  completeLibrary,
  libraryPath,
  libraryResponses,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryFacilityAnswers",
  component: LibraryFacilityAnswers,
  args: {
    rows: facilityRows(completeLibrary),
    librarySlug: "storybook-facilities",
    libraryName: completeLibrary.name,
    libraryPath,
    libraryDocumentId: completeLibrary.documentId,
    onSent: fn(),
  },
  parameters: {
    fixtureResponses: libraryResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof LibraryFacilityAnswers>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Grouped: Story = {
  args: { grouped: true, librarySlug: "storybook-facilities-grouped" },
}

export const SignedIn: Story = {
  args: { librarySlug: "storybook-facilities-signed-in" },
  parameters: { fixtureSession: readerSession },
}
