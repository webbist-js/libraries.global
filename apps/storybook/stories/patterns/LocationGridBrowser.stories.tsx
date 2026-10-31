import { LocationGridBrowser } from "@/components/ds/LocationGridBrowser"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/LocationGridBrowser",
  component: LocationGridBrowser,
  args: {
    items: [
      {
        slug: "northbridge",
        name: "Northbridge",
        subtitle: "Libraries and reading rooms",
        href: "/index/northbridge",
      },
      { slug: "eastmere", name: "Eastmere", href: "/index/eastmere" },
      {
        slug: "westhaven",
        name: "Westhaven",
        subtitle: "Coastal collections",
        href: "/index/westhaven",
      },
    ],
  },
} satisfies Meta<typeof LocationGridBrowser>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { items: [] } }
