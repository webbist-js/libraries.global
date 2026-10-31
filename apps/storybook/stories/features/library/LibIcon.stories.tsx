import { LibIcon, LIB_ICONS } from "@/components/library/LibrarySectionCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibIcon",
  component: LibIcon,
  args: { d: LIB_ICONS.building, size: 24 },
  render: (args) => (
    <span className="inline-flex items-center gap-2">
      <LibIcon {...args} />
      <span>Library</span>
    </span>
  ),
} satisfies Meta<typeof LibIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Location: Story = { args: { d: LIB_ICONS.map } }
export const OpeningHours: Story = { args: { d: LIB_ICONS.clock } }
export const Accessibility: Story = { args: { d: LIB_ICONS.access } }
