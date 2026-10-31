import { LibraryTypes } from "@/components/about/AboutChapterControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/About/LibraryTypes",
  component: LibraryTypes,
  args: {},
} satisfies Meta<typeof LibraryTypes>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
