import { LibrariesGlobalMark } from "@/components/global/LibrariesGlobalMark"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Global/LibrariesGlobalMark",
  component: LibrariesGlobalMark,
  args: {},
} satisfies Meta<typeof LibrariesGlobalMark>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
