import { NotificationInbox } from "@/components/notifications/NotificationInbox"
import { NotificationProvider } from "@/components/notifications/NotificationProvider"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Notifications/NotificationInbox",
  component: NotificationInbox,
  args: {},
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
  decorators: [
    (Story) => (
      <NotificationProvider>
        <Story />
      </NotificationProvider>
    ),
  ],
} satisfies Meta<typeof NotificationInbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
