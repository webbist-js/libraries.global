import { ChangePasswordForm } from "@/app/[locale]/auth/change-password/_components/ChangePasswordForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/ChangePasswordForm",
  component: ChangePasswordForm,
  args: { hasPassword: true, email: "member@example.invalid" },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof ChangePasswordForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SetPassword: Story = { args: { hasPassword: false } }
