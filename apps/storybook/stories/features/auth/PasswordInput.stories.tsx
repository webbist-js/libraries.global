import { PasswordInput } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/PasswordInput",
  component: PasswordInput,
  args: {
    "aria-label": "Password",
    placeholder: "Enter your password",
    autoComplete: "off",
  },
} satisfies Meta<typeof PasswordInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
