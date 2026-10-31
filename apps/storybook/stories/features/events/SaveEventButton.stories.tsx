import { SaveEventButton } from "@/components/events/SaveEventButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { eventFixture, eventResponses } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Events/SaveEventButton",
  component: SaveEventButton,
  args: { documentId: eventFixture.documentId },
  parameters: {
    fixtureResponses: eventResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof SaveEventButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedOut: Story = {
  parameters: {
    fixtureResponses: {
      "GET /api/saved-events": {
        status: 401,
        body: { error: "unauthenticated" },
      },
    },
    docs: { story: { inline: false } },
  },
}
