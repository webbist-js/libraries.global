import { StaffAccessRequired } from "@/components/staff/StaffAccessRequired"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/StaffAccessRequired",
  component: StaffAccessRequired,
  args: {},
  parameters: { docs: { story: { inline: false, height: "900px" } } },
} satisfies Meta<typeof StaffAccessRequired>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
