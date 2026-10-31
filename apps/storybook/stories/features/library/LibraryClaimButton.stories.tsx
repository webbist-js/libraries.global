import { LibraryClaimButton } from "@/components/library/LibraryClaimButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { readerSession } from "../../../.storybook/FixtureSession"
import {
  completeLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryClaimButton",
  component: LibraryClaimButton,
  args: {
    libraryDocumentId: completeLibrary.documentId,
    librarySlug: completeLibrary.slug,
    libraryName: completeLibrary.name,
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryClaimButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SignedIn: Story = { parameters: { fixtureSession: readerSession } }
