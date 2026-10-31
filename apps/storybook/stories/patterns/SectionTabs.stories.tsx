import { SectionTabs } from "@/components/ds/SectionTabs"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/SectionTabs",
  component: SectionTabs,
  args: {
    activeId: "overview",
    label: "Library navigation",
    tabs: [
      { id: "overview", label: "Overview", href: "/index/example" },
      { id: "events", label: "Events", href: "/events", count: 12 },
      {
        id: "community",
        label: "Community contributions",
        href: "/community",
        count: 0,
      },
    ],
  },
} satisfies Meta<typeof SectionTabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Pills: Story = { args: { variant: "pills" } }
export const Roomy: Story = { args: { roomy: true } }
