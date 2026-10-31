import { LibraryContexts } from "@/components/about/AboutChapterControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/About/LibraryContexts",
  component: LibraryContexts,
  args: {},
} satisfies Meta<typeof LibraryContexts>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
