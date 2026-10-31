import { BetaFeedback } from "@/components/beta/BetaFeedback"
import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Beta/BetaFeedback",
  component: BetaFeedback,
  args: { label: "Send beta feedback" },
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
} satisfies Meta<typeof BetaFeedback>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
