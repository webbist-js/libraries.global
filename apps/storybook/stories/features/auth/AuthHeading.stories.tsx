import { AuthHeading } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthHeading",
  component: AuthHeading,
  args: {
    title: "Welcome",
    italic: "back",
    subtitle: "Sign in to follow libraries and contribute useful information.",
  },
} satisfies Meta<typeof AuthHeading>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
