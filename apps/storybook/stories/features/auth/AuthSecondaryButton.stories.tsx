import { AuthSecondaryButton } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthSecondaryButton",
  component: AuthSecondaryButton,
  args: { children: "Use a sign-in link" },
} satisfies Meta<typeof AuthSecondaryButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
