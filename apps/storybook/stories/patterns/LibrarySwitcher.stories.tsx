import { LibrarySwitcher } from "@/components/ds/LibrarySwitcher"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/LibrarySwitcher",
  component: LibrarySwitcher,
  args: {
    libraries: [
      {
        id: "northbridge",
        name: "Northbridge Library",
        libraryType: "Public",
        slug: "northbridge",
        role: "owner",
        canGoLive: true,
      },
      {
        id: "mobile",
        name: "Eastmere Mobile",
        libraryType: "Mobile",
        slug: "eastmere",
        role: "editor",
        canGoLive: false,
      },
    ],
    currentId: "northbridge",
    hrefFor: (id: string) => `/staff/libraries/${id}`,
  },
} satisfies Meta<typeof LibrarySwitcher>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
