import { NewsletterPreference } from "@/components/notifications/NewsletterPreference"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Notifications/NewsletterPreference",
  component: NewsletterPreference,
  args: {},
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof NewsletterPreference>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
