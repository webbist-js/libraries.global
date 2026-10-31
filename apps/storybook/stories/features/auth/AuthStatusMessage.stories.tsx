import { AuthStatusMessage } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthStatusMessage",
  component: AuthStatusMessage,
  args: {
    status: {
      tone: "error",
      text: "We could not sign you in. Check your details and try again.",
    },
  },
} satisfies Meta<typeof AuthStatusMessage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Success: Story = {
  args: {
    status: {
      tone: "ok",
      text: "A sign-in link is on its way. Check your inbox.",
    },
  },
}
