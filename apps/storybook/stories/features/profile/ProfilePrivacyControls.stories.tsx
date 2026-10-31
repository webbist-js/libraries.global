import { ProfilePrivacyControls } from "@/app/[locale]/profile/[username]/_components/ProfilePrivacyControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/ProfilePrivacyControls",
  component: ProfilePrivacyControls,
  args: {
    initialPrefs: {
      showLocation: true,
      showAffiliation: true,
      showActivity: true,
      showFollows: true,
    },
    message: "Choose which details appear on your public profile.",
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "800px" } },
  },
} satisfies Meta<typeof ProfilePrivacyControls>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
