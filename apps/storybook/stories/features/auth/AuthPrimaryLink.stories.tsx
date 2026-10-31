import { AuthPrimaryLink } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthPrimaryLink",
  component: AuthPrimaryLink,
  args: { href: "/auth/signin", children: "Sign in" },
} satisfies Meta<typeof AuthPrimaryLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
