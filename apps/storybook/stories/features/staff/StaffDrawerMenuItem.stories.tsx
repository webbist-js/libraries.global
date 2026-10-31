import { StaffDrawerMenuItem } from "@/components/staff/StaffDrawerMenuItem"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

const meta = {
  title: "Features/Staff/StaffDrawerMenuItem",
  component: StaffDrawerMenuItem,
  args: { presentation: "button", drawer: "staff", onOpen: fn() },
} satisfies Meta<typeof StaffDrawerMenuItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
