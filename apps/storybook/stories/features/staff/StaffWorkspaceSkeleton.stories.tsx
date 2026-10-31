import { StaffWorkspaceSkeleton } from "@/components/staff/StaffWorkspaceSkeleton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/StaffWorkspaceSkeleton",
  component: StaffWorkspaceSkeleton,
  args: { label: "Loading your libraries" },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof StaffWorkspaceSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
