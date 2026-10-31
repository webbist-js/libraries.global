import { Breadcrumb } from "@/components/ds/Breadcrumb"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Breadcrumb",
  component: Breadcrumb,
  args: {
    items: [
      { label: "Home", href: "/" },
      { label: "Libraries", href: "/index" },
      { label: "Northbridge Library" },
    ],
  },
} satisfies Meta<typeof Breadcrumb>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const AncestorsOnly: Story = { args: { ancestorsOnly: true } }
