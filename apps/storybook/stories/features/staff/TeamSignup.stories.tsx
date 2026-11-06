import { TeamSignup } from "@/components/staff/TeamSignup"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/TeamSignup",
  component: TeamSignup,
  args: {
    verified: true,
    user: { name: "Maya S.", email: "member@example.invalid" },
  },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof TeamSignup>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const EmailNotVerified: Story = { args: { verified: false } }
