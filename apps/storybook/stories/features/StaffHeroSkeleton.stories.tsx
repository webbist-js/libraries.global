import { StaffHeroSkeleton } from "@/components/staff/StaffWorkspaceSkeleton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/StaffHeroSkeleton",
  component: StaffHeroSkeleton,
  args: {},
} satisfies Meta<typeof StaffHeroSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
