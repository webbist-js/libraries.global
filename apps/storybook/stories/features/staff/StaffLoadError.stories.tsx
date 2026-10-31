import { StaffLoadError } from "@/components/staff/StaffLoadError"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/StaffLoadError",
  component: StaffLoadError,
  args: { what: "Your staff workspace" },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof StaffLoadError>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
