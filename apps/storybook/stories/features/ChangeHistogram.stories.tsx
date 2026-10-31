import { ChangeHistogram } from "@/components/library/ChangeHistogram"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/ChangeHistogram",
  component: ChangeHistogram,
  args: {
    months: [
      { month: "2026-01", batches: 4, fields: 12, contributors: 3 },
      { month: "2026-02", batches: 8, fields: 23, contributors: 5 },
      { month: "2026-03", batches: 2, fields: 6, contributors: 2 },
    ],
    verificationEvents: ["2026-02-15"],
  },
} satisfies Meta<typeof ChangeHistogram>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { months: [], verificationEvents: [] } }
