import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Staff/StaffAreaTabs",
  component: StaffAreaTabs,
  args: { active: "overview" },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof StaffAreaTabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
