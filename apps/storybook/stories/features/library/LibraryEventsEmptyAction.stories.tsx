import { LibraryEventsEmptyAction } from "@/components/library/LibraryEventsEmptyAction"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryEventsEmptyAction",
  component: LibraryEventsEmptyAction,
  args: {
    documentId: completeLibrary.documentId,
    librarySlug: completeLibrary.slug,
    libraryName: completeLibrary.name,
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryEventsEmptyAction>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
