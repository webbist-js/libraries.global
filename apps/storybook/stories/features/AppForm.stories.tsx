import { AppField } from "@/components/forms/AppField"
import { AppForm } from "@/components/forms/AppForm"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useForm } from "react-hook-form"
import { fn, expect } from "storybook/test"

const meta = {
  title: "Features/Forms/AppForm",
  args: { onSubmit: fn(), disabled: false },
  render: function Example(args) {
    const form = useForm({ defaultValues: { name: "Northbridge Library" } })

    return (
      <AppForm {...args} form={form}>
        <AppField name="name" label="Library name" />
        <Button type="submit">Save example</Button>
      </AppForm>
    )
  },
} satisfies Meta<{
  onSubmit: (values: { name: string }) => void
  disabled: boolean
}>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Save example" }))
    await expect(args.onSubmit).toHaveBeenCalled()
  },
}
export const Disabled: Story = { args: { disabled: true } }
