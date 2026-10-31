import { LibraryTasksPanel } from "@/components/library/LibrarySidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  completeLibrary,
  mobileLibrary,
  digitalLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"
import { libraryFixture } from "../../fixtures/library"

const meta = {
  title: "Features/Library/LibraryTasksPanel",
  component: LibraryTasksPanel,
  args: { library: completeLibrary, facilityQuestions: 4 },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryTasksPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SparseRecord: Story = { args: { library: libraryFixture } }
export const Mobile: Story = { args: { library: mobileLibrary } }
export const Digital: Story = { args: { library: digitalLibrary } }
