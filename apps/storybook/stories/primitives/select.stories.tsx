import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within, waitFor } from "storybook/test"

const meta = {
  title: "Primitives/select",
  component: Select,
  args: {},
  render: (args) => (
    <Select {...args}>
      <SelectTrigger aria-label="Library type" className="w-64">
        <SelectValue placeholder="Choose a type" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Library types</SelectLabel>
          <SelectItem value="public">Public</SelectItem>
          <SelectSeparator />
          <SelectItem value="academic">Academic</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
} satisfies Meta<typeof Select>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ChoosePublic: Story = {
  parameters: { docs: { story: { inline: false, height: "400px" } } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Library type" })
    )
    const option = await within(document.body).findByRole("option", {
      name: "Public",
    })
    await waitFor(() => expect(option).toHaveFocus())
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(
        canvas.getByRole("combobox", { name: "Library type" })
      ).toHaveTextContent("Public")
    )
  },
}
