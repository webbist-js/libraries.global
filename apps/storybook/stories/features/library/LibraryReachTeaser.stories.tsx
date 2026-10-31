import { LibraryReachTeaser } from "@/components/library/LibraryReachTeaser"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryReachTeaser",
  component: LibraryReachTeaser,
  args: { libraryId: completeLibrary.documentId },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryReachTeaser>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Embedded: Story = { args: { embedded: true } }
