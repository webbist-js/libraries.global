import { ApiGuidePanel } from "@/components/staff/TeamApiPanels"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/ApiGuidePanel",
  component: ApiGuidePanel,
  args: {},
} satisfies Meta<typeof ApiGuidePanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
