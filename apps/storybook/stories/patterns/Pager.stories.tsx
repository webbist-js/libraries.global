import { Pager } from "@/components/ds/Pager"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Pager",
  component: Pager,
  args: {
    prev: { label: "Getting started", href: "/knowledge/start" },
    next: { label: "Contributing a record", href: "/knowledge/contribute" },
  },
} satisfies Meta<typeof Pager>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const FirstPage: Story = { args: { prev: undefined } }
export const LastPage: Story = { args: { next: undefined } }
