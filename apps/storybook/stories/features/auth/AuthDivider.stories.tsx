import { AuthDivider } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthDivider",
  component: AuthDivider,
  args: {},
} satisfies Meta<typeof AuthDivider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
