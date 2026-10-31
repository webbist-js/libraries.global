import { AuthCheckbox } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Auth/AuthCheckbox",
  component: AuthCheckbox,
  args: {
    label: "Remember this browser",
    hint: "Use this only on a device you trust.",
    defaultChecked: false,
  },
} satisfies Meta<typeof AuthCheckbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Checked: Story = { args: { defaultChecked: true } }
