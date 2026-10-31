import { CurrentPlanBadge } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanBits"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/CurrentPlanBadge",
  component: CurrentPlanBadge,
  args: {},
} satisfies Meta<typeof CurrentPlanBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
