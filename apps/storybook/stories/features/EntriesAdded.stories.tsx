import { EntriesAdded } from "@/components/blog/EntriesAdded"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Blog/EntriesAdded",
  component: EntriesAdded,
  args: { value: 1240, origin: "Community contributions" },
} satisfies Meta<typeof EntriesAdded>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
