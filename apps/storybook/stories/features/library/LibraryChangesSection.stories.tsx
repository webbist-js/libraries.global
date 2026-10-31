import { LibraryChangesSection } from "@/components/library/LibrarySections"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  libraryHistory,
  libraryHistoryStats,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryChangesSection",
  component: LibraryChangesSection,
  args: {
    library: completeLibrary,
    history: libraryHistory,
    stats: libraryHistoryStats,
  },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryChangesSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoHistory: Story = { args: { history: null, stats: null } }
