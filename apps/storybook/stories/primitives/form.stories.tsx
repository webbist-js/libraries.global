import { Button } from "@/components/ui/button"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useForm } from "react-hook-form"
import { expect } from "storybook/test"

function ExampleForm() {
  const form = useForm({ defaultValues: { name: "" } })

  return (
    <Form {...form}>
      <form
        className="grid max-w-md gap-4"
        onSubmit={form.handleSubmit(() => {})}
      >
        <FormField
          control={form.control}
          name="name"
          rules={{ required: "Enter a library name." }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Library name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                Use the library’s published name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="primary">
          Save example
        </Button>
      </form>
    </Form>
  )
}
const meta = {
  title: "Primitives/form",
  args: {},
  render: () => <ExampleForm />,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const RequiredValidation: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Save example" }))
    await expect(await canvas.findByText("Enter a library name.")).toBeVisible()
    await expect(canvas.getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "true"
    )
  },
}
