import { StaffBackLink } from "@/components/staff/StaffBackLink"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/StaffBackLink",
  component: StaffBackLink,
  args: { href: "/staff", label: "Your libraries" },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof StaffBackLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
