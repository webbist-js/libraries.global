import { MetadataList } from "@/components/ds/MetadataList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Patterns/MetadataList",
  component: MetadataList,
  args: {
    rows: [
      { label: "Section", value: "Library practice" },
      { label: "Words", value: "1,240" },
      {
        label: "Licence",
        value: <a href="https://example.invalid/licence">CC BY-SA 4.0</a>,
      },
    ],
  },
} satisfies Meta<typeof MetadataList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { rows: [] } }
export const LabelsAndValues: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole("term")).toHaveLength(3)
    await expect(canvas.getAllByRole("definition")).toHaveLength(3)
    await expect(
      canvas.getByRole("link", { name: "CC BY-SA 4.0" })
    ).toHaveAttribute("href", "https://example.invalid/licence")
  },
}
