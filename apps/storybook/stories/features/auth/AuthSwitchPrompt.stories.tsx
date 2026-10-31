import { AuthSwitchPrompt } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthSwitchPrompt",
  component: AuthSwitchPrompt,
  args: {
    prompt: "Already have an account?",
    linkLabel: "Sign in",
    href: "/auth/signin",
  },
} satisfies Meta<typeof AuthSwitchPrompt>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
