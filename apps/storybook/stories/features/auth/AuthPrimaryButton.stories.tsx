import { AuthPrimaryButton } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthPrimaryButton",
  component: AuthPrimaryButton,
  args: { children: "Continue" },
} satisfies Meta<typeof AuthPrimaryButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
