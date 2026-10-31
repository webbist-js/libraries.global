import { LibraryVirtualTour } from "@/components/library/LibraryVirtualTour"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibraryVirtualTour",
  component: LibraryVirtualTour,
  args: { url: "/tour-fixture.html" },
} satisfies Meta<typeof LibraryVirtualTour>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
