import { LibraryDetailPage } from "@/components/library/LibraryDetailPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  mobileLibrary,
  digitalLibrary,
  libraryPath,
  libraryArea,
  libraryHistory,
  libraryHistoryStats,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"
import { libraryFixture } from "../../fixtures/library"

const meta = {
  title: "Features/Library/LibraryDetailPage",
  component: LibraryDetailPage,
  args: {
    library: completeLibrary,
    locale: "en",
    area: libraryArea,
    history: libraryHistory,
    historyStats: libraryHistoryStats,
    followers: 12,
    canonicalUrl: "https://example.invalid" + libraryPath,
  },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    react: { rsc: true },

    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
    layout: "fullscreen",
  },
} satisfies Meta<typeof LibraryDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SparseRecord: Story = { args: { library: libraryFixture } }
export const Mobile: Story = { args: { library: mobileLibrary } }
export const Digital: Story = { args: { library: digitalLibrary } }
export const Missing: Story = { args: { library: null } }
