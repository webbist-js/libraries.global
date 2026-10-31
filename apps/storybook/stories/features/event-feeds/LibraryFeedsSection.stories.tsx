import { LibraryFeedsSection } from "@/components/event-feeds/LibraryFeedsSection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { feedFixture } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Event feeds/LibraryFeedsSection",
  component: LibraryFeedsSection,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  args: {
    entry: {
      library: {
        documentId: "example-library",
        name: "Northbridge Library",
        slug: "northbridge",
      },
      feeds: [feedFixture],
    },
  },
} satisfies Meta<typeof LibraryFeedsSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  args: {
    entry: {
      library: {
        documentId: "example-library",
        name: "Northbridge Library",
        slug: "northbridge",
      },
      feeds: [],
    },
  },
}
