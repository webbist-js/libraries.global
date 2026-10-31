import { OnboardingShell } from "@/app/[locale]/(dashboard)/profile/onboarding/_components/OnboardingShell"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/OnboardingShell",
  component: OnboardingShell,
  args: {
    sessionUser: readerSession.user,
    initialProfile: null,
    avatarUrl: null,
    imageUploadsEnabled: false,
  },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof OnboardingShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
