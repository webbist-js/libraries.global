import { FactCard } from "@/components/library/LibraryHoursTable"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/Fact card",
  component: FactCard,
  args: {
    icon: "mdi:clock-outline",
    label: "Opening hours",
    value: "09:00–17:00",
    note: "Staffed throughout the day.",
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FactCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const LongContent: Story = {
  args: {
    value: "09:00–12:30 · 13:30–18:00",
    note: "Self-service access in the afternoon. Bring your library card and check the accessible entrance before travelling.",
  },
}
