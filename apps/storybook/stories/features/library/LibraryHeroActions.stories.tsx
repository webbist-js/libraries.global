import { LibraryHeroActions } from "@/components/library/LibraryHeroActions"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryHeroActions",
  component: LibraryHeroActions,
  args: {
    libraryDocumentId: completeLibrary.documentId,
    librarySlug: completeLibrary.slug,
    libraryName: completeLibrary.name,
    website: completeLibrary.website,
    directionsUrl: "https://example.invalid/directions",
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryHeroActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
