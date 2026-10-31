import { EmptyState } from "@/components/ds/EmptyState"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/EmptyState",
  component: EmptyState,
  args: {
    lead: "No libraries saved yet",
    detail: "Save a library to find it here next time.",
    surface: true,
    compact: false,
    headingLevel: 2,
  },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
export const WithAction: Story = {
  args: { action: <Button variant="primary">Find libraries</Button> },
}
export const LegacyMessage: Story = {
  args: {
    lead: undefined,
    message: "No results match these filters",
    detail: "Try a broader location.",
  },
}
