import { LibraryChangeTimeline } from "@/components/library/LibraryChangeTimeline"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryHistory,
  emptyHistory,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryChangeTimeline",
  component: LibraryChangeTimeline,
  args: { documentId: completeLibrary.documentId, initial: libraryHistory },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryChangeTimeline>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { initial: emptyHistory } }
