import { ProChip } from "@/components/atlas/atlas-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Atlas/ProChip",
  component: ProChip,
  args: {},
} satisfies Meta<typeof ProChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
