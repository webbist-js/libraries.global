import { AuthLeftPanel } from "@/app/[locale]/auth/_components/AuthLeftPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthLeftPanel",
  component: AuthLeftPanel,
  args: { mode: "signin" },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
} satisfies Meta<typeof AuthLeftPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Register: Story = { args: { mode: "register" } }
