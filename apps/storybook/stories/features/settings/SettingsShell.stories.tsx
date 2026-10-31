import { SettingsShell } from "@/app/[locale]/profile/settings/_components/SettingsShell"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Settings/SettingsShell",
  component: SettingsShell,
  args: {
    profile,
    sessionUser: readerSession.user,
    avatarUrl: null,
    imageUploadsEnabled: false,
    embedded: true,
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof SettingsShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
