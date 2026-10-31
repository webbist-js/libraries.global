import { ConfirmIdentityLook } from "@/components/mobile/live/LiveConsoleScreens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Mobile/ConfirmIdentityLook",
  component: ConfirmIdentityLook,
  args: { children: "Check the library and route before beginning a session." },
} satisfies Meta<typeof ConfirmIdentityLook>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
