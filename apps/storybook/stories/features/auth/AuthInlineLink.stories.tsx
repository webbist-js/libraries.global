import { AuthInlineLink } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthInlineLink",
  component: AuthInlineLink,
  args: { href: "/legal/privacy", children: "Privacy notice" },
} satisfies Meta<typeof AuthInlineLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
