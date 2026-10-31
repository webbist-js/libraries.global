import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import ProfileDrawer from "@/components/profile/ProfileDrawer"
import { ProfileDrawerMount } from "@/components/profile/ProfileDrawerMount"
import { ProfileDrawerTrigger } from "@/components/profile/ProfileDrawerTrigger"
import { closeProfileDrawer } from "@/lib/profile-drawer"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { userEvent } from "storybook/test"

import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/Drawer",
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "740px" } },
  },
  beforeEach: () => {
    closeProfileDrawer()

    return () => closeProfileDrawer()
  },
  render: () => (
    <ContactModalProvider>
      <ProfileDrawerTrigger user={readerSession.user} />
      <ProfileDrawer />
    </ContactModalProvider>
  ),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const MountedEntryPoint: Story = {
  render: () => (
    <ContactModalProvider>
      <ProfileDrawerTrigger user={readerSession.user} />
      <ProfileDrawerMount />
    </ContactModalProvider>
  ),
}
export const Opened: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Your profile" }))
  },
}
