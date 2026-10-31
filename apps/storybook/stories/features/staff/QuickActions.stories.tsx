import { QuickActions } from "@/app/[locale]/(dashboard)/staff/[slug]/_components/QuickActions"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/QuickActions",
  component: QuickActions,
  args: {
    actions: [
      {
        icon: "mdi:pencil-outline",
        label: "Edit record",
        href: "/contribute/index?library=example-library",
      },
      {
        icon: "mdi:calendar-outline",
        label: "Manage events",
        href: "/staff/northbridge/events",
      },
    ],
  },
} satisfies Meta<typeof QuickActions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
