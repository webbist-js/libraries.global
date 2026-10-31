import { SignInForm } from "@/app/[locale]/auth/signin/_components/SignInForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/SignInForm",
  component: SignInForm,
  args: { returnTo: "/libraries" },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof SignInForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
