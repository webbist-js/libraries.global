import { PrivacySection } from "@/app/[locale]/profile/settings/_components/PrivacySection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  profile,
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Settings/PrivacySection",
  component: PrivacySection,
  args: { profile, visibility: "public", onVisibilityChange: fn() },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof PrivacySection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
