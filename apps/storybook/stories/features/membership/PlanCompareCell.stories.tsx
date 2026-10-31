import { PlanCompareCell } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanCompareCell"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/PlanCompareCell",
  component: PlanCompareCell,
  args: { cell: "yes" },
} satisfies Meta<typeof PlanCompareCell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Soon: Story = { args: { cell: "soon" } }
export const Excluded: Story = { args: { cell: "no" } }
export const ExportAllowance: Story = {
  args: { cell: "yes", label: "1,000 rows", isExport: true },
}
