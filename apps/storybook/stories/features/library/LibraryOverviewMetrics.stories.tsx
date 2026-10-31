import { LibraryOverviewMetrics } from "@/components/library/LibraryOverviewMetrics"
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
  title: "Features/Library/LibraryOverviewMetrics",
  component: LibraryOverviewMetrics,
  args: { library: completeLibrary },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryOverviewMetrics>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SparseRecord: Story = { args: { library: libraryFixture } }
export const Mobile: Story = { args: { library: mobileLibrary } }
export const Digital: Story = { args: { library: digitalLibrary } }
