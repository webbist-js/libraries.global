import { EventModal } from "@/components/events/EventModal"
import {
  EventModalProvider,
  useEventModal,
} from "@/components/events/EventModalContext"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { userEvent } from "storybook/test"

import { eventFixture, eventResponses } from "../../fixtures/workspace/events"

function Trigger() {
  const { openModal } = useEventModal()

  return (
    <Button onClick={() => openModal(eventFixture.documentId)}>
      View storytime details
    </Button>
  )
}
const meta = {
  title: "Features/Events/EventModal",
  parameters: {
    fixtureResponses: eventResponses,
    docs: { story: { inline: false, height: "780px" } },
  },
  render: () => (
    <EventModalProvider>
      <Trigger />
      <EventModal />
    </EventModalProvider>
  ),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unavailable: Story = {
  parameters: {
    fixtureResponses: {
      ...eventResponses,
      "GET /api/public-proxy/api/events/event/example-storytime": {
        status: 404,
        body: { error: "not_found" },
      },
    },
  },
}
export const Opened: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "View storytime details" })
    )
  },
}
