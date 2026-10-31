import { PasswordStrengthMeter } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

const meta = {
  title: "Features/Auth/PasswordStrengthMeter",
  component: PasswordStrengthMeter,
  // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- Synthetic text for the strength-meter preview.
  args: { id: "example-strength", password: "library-example-passphrase" },
  render: function Example(args) {
    const id = useId()

    return <PasswordStrengthMeter {...args} id={id} />
  },
} satisfies Meta<typeof PasswordStrengthMeter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
