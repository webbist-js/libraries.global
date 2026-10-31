import { FieldError } from "@/app/[locale]/auth/_components/AuthFormParts"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

const meta = {
  title: "Features/Auth/FieldError",
  component: FieldError,
  args: { id: "example-error", message: "Enter a valid email address." },
  render: function Example(args) {
    const id = useId()

    return <FieldError {...args} id={id} />
  },
} satisfies Meta<typeof FieldError>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
