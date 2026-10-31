import { ResetPasswordForm } from "@/app/[locale]/auth/reset-password/_components/ResetPasswordForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/ResetPasswordForm",
  component: ResetPasswordForm,
  args: { token: null },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof ResetPasswordForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithToken: Story = { args: { token: "synthetic-reset-token" } }
