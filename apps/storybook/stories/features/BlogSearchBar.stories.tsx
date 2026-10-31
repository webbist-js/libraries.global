import { BlogSearchBar } from "@/components/blog/BlogSearchBar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Blog/BlogSearchBar",
  component: BlogSearchBar,
  args: { initialQuery: "community libraries" },
} satisfies Meta<typeof BlogSearchBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
