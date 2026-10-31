import { PlanCompareTable } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareTable"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/PlanCompareTable",
  component: PlanCompareTable,
  args: { currentPlan: "free" },
} satisfies Meta<typeof PlanCompareTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
