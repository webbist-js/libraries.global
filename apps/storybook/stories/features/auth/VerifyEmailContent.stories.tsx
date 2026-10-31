import { VerifyEmailContent } from "@/app/[locale]/auth/verify-email-sent/_components/VerifyEmailContent"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/VerifyEmailContent",
  component: VerifyEmailContent,
  args: { state: "sent" },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof VerifyEmailContent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Expired: Story = { args: { state: "expired" } }
export const Invalid: Story = { args: { state: "invalid" } }
export const Unverified: Story = { args: { state: "unverified" } }
