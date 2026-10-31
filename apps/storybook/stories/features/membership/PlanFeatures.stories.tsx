import { PlanFeatures } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanBits"
import { PLANS } from "@/lib/plans"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/PlanFeatures",
  component: PlanFeatures,
  args: { plan: PLANS.find((p) => p.key === "pro")! },
} satisfies Meta<typeof PlanFeatures>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
