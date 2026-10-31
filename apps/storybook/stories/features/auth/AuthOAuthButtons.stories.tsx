import { AuthOAuthButtons } from "@/app/[locale]/auth/_components/AuthOAuthButtons"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthOAuthButtons",
  component: AuthOAuthButtons,
  args: { mode: "signin" },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof AuthOAuthButtons>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Register: Story = { args: { mode: "register" } }
