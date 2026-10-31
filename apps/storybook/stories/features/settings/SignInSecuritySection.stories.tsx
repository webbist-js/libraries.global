import { SignInSecuritySection } from "@/app/[locale]/profile/settings/_components/SignInSecuritySection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Settings/SignInSecuritySection",
  component: SignInSecuritySection,
  args: {},
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof SignInSecuritySection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
