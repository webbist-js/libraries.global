import { BackLink } from "@/components/ds/BackLink"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/BackLink",
  component: BackLink,
  args: { href: "/index", children: "All libraries", icon: "arrow" },
} satisfies Meta<typeof BackLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Chevron: Story = { args: { icon: "chevron" } }
