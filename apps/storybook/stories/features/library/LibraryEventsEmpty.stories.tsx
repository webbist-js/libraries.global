import { LibraryEventsEmpty } from "@/components/library/LibrarySections"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryEventsEmpty",
  component: LibraryEventsEmpty,
  args: {
    documentId: completeLibrary.documentId,
    librarySlug: completeLibrary.slug,
    libraryName: completeLibrary.name,
  },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryEventsEmpty>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
