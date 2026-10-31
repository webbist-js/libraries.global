import { AuthInboxHint } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthInboxHint",
  component: AuthInboxHint,
  args: {
    subject: "Your Libraries Global sign-in link",
    detail:
      "The link expires after a short time. Check your spam folder if it does not arrive.",
  },
} satisfies Meta<typeof AuthInboxHint>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
