import { AuthNote } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthNote",
  component: AuthNote,
  args: {
    children:
      "We use your email only for your account and the updates you choose.",
  },
} satisfies Meta<typeof AuthNote>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
