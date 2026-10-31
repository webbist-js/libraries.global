import { Divider } from "@/components/drives/builder-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Drives/Divider",
  component: Divider,
  args: {},
} satisfies Meta<typeof Divider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
