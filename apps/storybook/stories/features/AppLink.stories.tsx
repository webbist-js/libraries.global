import { AppLink } from "@/components/elementary/AppLink"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/Links/App link",
  component: AppLink,
  args: { href: "/libraries", children: "Browse libraries" },
} satisfies Meta<typeof AppLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
