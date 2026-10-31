import { AuthField } from "@/app/[locale]/auth/_components/AuthFormParts"
import { Input } from "@/components/ui/input"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

const meta = {
  title: "Features/Auth/AuthField",
  component: AuthField,
  args: {
    id: "example-email",
    label: "Email address",
    hint: "Use an address you can access.",
    children: null,
  },
  render: function Example(args) {
    const id = useId()

    return (
      <AuthField {...args} id={id}>
        <Input id={id} type="email" placeholder="you@example.invalid" />
      </AuthField>
    )
  },
} satisfies Meta<typeof AuthField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
