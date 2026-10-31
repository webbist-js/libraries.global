import { RecordMetrics } from "@/components/dashboard/RecordMetrics"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Dashboard/RecordMetrics",
  component: RecordMetrics,
  args: {
    items: [
      { label: "Libraries", value: "124", note: "Records in the index" },
      {
        label: "Recorded details",
        value: "3 of 5",
        segments: [true, true, true, false, false],
      },
      { label: "Events", value: "12", href: "https://example.invalid/events" },
    ],
  },
} satisfies Meta<typeof RecordMetrics>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { items: [] } }
