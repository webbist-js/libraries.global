import { LibraryCopyButton } from "@/components/library/LibraryCopyButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibraryCopyButton",
  component: LibraryCopyButton,
  args: {
    text: "https://example.invalid/libraries/northbridge",
    label: "Copy library link",
  },
} satisfies Meta<typeof LibraryCopyButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
