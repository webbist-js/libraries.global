import { ForgotPasswordForm } from "@/app/[locale]/auth/forgot-password/_components/ForgotPasswordForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/ForgotPasswordForm",
  component: ForgotPasswordForm,
  args: {},
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof ForgotPasswordForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
