import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { ProfileWorkspaceActions } from "@/components/profile/ProfileWorkspace"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/ProfileWorkspaceActions",
  component: ProfileWorkspaceActions,
  args: {
    user: readerSession.user,
    onHandoff: fn((action: () => void) => action()),
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
  decorators: [
    (Story) => (
      <ContactModalProvider>
        <Story />
      </ContactModalProvider>
    ),
  ],
} satisfies Meta<typeof ProfileWorkspaceActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
