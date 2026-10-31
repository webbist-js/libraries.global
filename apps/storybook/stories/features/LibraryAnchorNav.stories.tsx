import { LibraryAnchorNav } from "@/components/library/LibraryAnchorNav"
import { LIB_ICONS } from "@/components/library/LibrarySectionCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Library/LibraryAnchorNav",
  component: LibraryAnchorNav,
  args: {
    items: [
      { label: "Opening hours", icon: LIB_ICONS.clock, href: "#hours" },
      {
        label: "Accessibility",
        icon: LIB_ICONS.access,
        href: "#access",
      },
      { label: "Collections", icon: LIB_ICONS.book, href: "#collections" },
    ],
  },
} satisfies Meta<typeof LibraryAnchorNav>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Sidebar: Story = { args: { sidebar: true } }
