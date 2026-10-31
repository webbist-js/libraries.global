import { LibraryFollowerCount } from "@/components/library/LibraryFollowerCount"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibraryFollowerCount",
  component: LibraryFollowerCount,
  args: { initial: 48, libraryDocumentId: "example-library" },
} satisfies Meta<typeof LibraryFollowerCount>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Zero: Story = { args: { initial: 0 } }
export const One: Story = { args: { initial: 1 } }
