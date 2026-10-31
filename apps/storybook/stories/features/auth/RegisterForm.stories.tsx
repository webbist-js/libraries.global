import { RegisterForm } from "@/app/[locale]/auth/register/_components/RegisterForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/RegisterForm",
  component: RegisterForm,
  args: {},
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof RegisterForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
