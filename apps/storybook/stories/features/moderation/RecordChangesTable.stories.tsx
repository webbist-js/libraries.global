import { RecordChangesTable } from "@/components/moderation/RecordChangesTable"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/RecordChangesTable",
  component: RecordChangesTable,
  args: {
    submissionType: "library_correction",
    fields: {
      phone: "+44 20 0000 0000",
      name: "Northbridge Community Library",
    },
    review: { current: { phone: "", name: "Northbridge Library" }, names: {} },
  },
} satisfies Meta<typeof RecordChangesTable>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
