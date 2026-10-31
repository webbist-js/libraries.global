import { BetaForms } from "@/components/beta/BetaForms"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  profileResponses,
  readerSession,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Beta/BetaForms",
  component: BetaForms,
  args: { next: "/libraries", locale: "en", available: true },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof BetaForms>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unavailable: Story = { args: { available: false } }
