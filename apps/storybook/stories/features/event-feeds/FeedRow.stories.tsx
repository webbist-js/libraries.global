import { FeedRow } from "@/components/event-feeds/FeedRow"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { feedFixture } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Event feeds/FeedRow",
  component: FeedRow,
  decorators: [
    (Story) => (
      <ul className="m-0 list-none p-0">
        <Story />
      </ul>
    ),
  ],
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  args: {
    feed: feedFixture,
    libraryDocumentId: "example-library",
    librarySlug: "northbridge",
    libraryName: "Northbridge Library",
  },
} satisfies Meta<typeof FeedRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
