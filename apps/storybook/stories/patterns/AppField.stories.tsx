import { AppField } from "@/components/forms/AppField"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { ComponentProps } from "react"
import { useForm } from "react-hook-form"
import { expect } from "storybook/test"

function Example(args: ComponentProps<typeof AppField>) {
  const form = useForm({ defaultValues: { [args.name]: "" } })

  return (
    <Form {...form}>
      <form
        className="grid max-w-md gap-4"
        onSubmit={form.handleSubmit(() =>
          form.setError(args.name, { message: "Enter a library name." })
        )}
      >
        <AppField {...args} />
        <Button type="submit">Validate example</Button>
      </form>
    </Form>
  )
}
const meta = {
  title: "Patterns/AppField",
  component: AppField,
  args: {
    name: "name",
    label: "Library name",
    description: "Use the published name.",
    endAdornment: "Library",
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<typeof AppField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { name: "name" } }
export const Validation: Story = {
  args: { name: "name" },
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole("textbox", { name: "Library name" })
    await userEvent.click(canvas.getByText("Library name", { exact: true }))
    await expect(input).toHaveFocus()
    await expect(input).toHaveAccessibleDescription("Use the published name.")
    await userEvent.click(
      canvas.getByRole("button", { name: "Validate example" })
    )
    await expect(input).toHaveAttribute("aria-invalid", "true")
    await expect(input).toHaveAccessibleDescription(
      "Use the published name. Enter a library name."
    )
  },
}
export const CustomId: Story = {
  args: { id: "named-library" },
}
