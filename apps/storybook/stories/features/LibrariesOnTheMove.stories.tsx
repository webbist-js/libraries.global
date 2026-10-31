import { LibrariesOnTheMove } from "@/components/library/LibrariesOnTheMove"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibrariesOnTheMove",
  component: LibrariesOnTheMove,
  args: {
    libraries: [
      {
        documentId: "example-mobile",
        name: "Northbridge Mobile Library",
        slug: "northbridge-mobile",
      },
    ],
  },
} satisfies Meta<typeof LibrariesOnTheMove>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { libraries: [] } }
