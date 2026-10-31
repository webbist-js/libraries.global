import { WritingToolbarButton } from "@/components/ds/WritingToolbarButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

const meta = {
  title: "Primitives/WritingToolbarButton",
  component: WritingToolbarButton,
  args: { icon: "mdi:undo", label: "Undo", onClick: fn() },
} satisfies Meta<typeof WritingToolbarButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Active: Story = {
  args: { icon: "mdi:format-bold", label: "Bold", active: true },
}
export const Disabled: Story = { args: { disabled: true } }
