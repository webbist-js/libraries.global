import { ReplaceFeedForm } from "@/components/event-feeds/ReplaceFeedForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { feedFixture } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Event feeds/ReplaceFeedForm",
  component: ReplaceFeedForm,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  args: {
    feed: feedFixture,
    libraryName: "Northbridge Library",
    libraryDocumentId: "example-library",
    librarySlug: "northbridge",
  },
} satisfies Meta<typeof ReplaceFeedForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
