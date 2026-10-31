import { ComingSoonChip } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanBits"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/ComingSoonChip",
  component: ComingSoonChip,
  args: { label: "Coming soon" },
} satisfies Meta<typeof ComingSoonChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
