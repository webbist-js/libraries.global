import { StaffDrawerTab } from "@/components/staff/StaffDrawerTab"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Staff/StaffDrawerTab",
  component: StaffDrawerTab,
  args: { onOpen: fn() },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof StaffDrawerTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
