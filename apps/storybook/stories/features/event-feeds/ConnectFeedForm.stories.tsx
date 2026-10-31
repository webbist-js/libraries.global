import { ConnectFeedForm } from "@/components/event-feeds/ConnectFeedForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Event feeds/ConnectFeedForm",
  component: ConnectFeedForm,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  args: {
    libraries: [
      {
        documentId: "example-library",
        name: "Northbridge Library",
        slug: "northbridge",
      },
    ],
    oauth: { eventbrite: false },
  },
} satisfies Meta<typeof ConnectFeedForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
