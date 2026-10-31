import { CatalogueSearch } from "@/components/ds/CatalogueSearch"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn, expect, within } from "storybook/test"

const meta = {
  title: "Patterns/CatalogueSearch",
  component: CatalogueSearch,
  args: {
    label: "Library",
    placeholder: "Choose a library",
    load: async (query: string) => ({
      rows: [
        { documentId: "example-1", name: "Northbridge Library" },
        { documentId: "example-2", name: "Eastmere Library" },
      ].filter((row) => row.name.toLowerCase().includes(query.toLowerCase())),
      more: false,
    }),
    describe: () => "Example library · Public",
    onSelect: fn(),
  },
} satisfies Meta<typeof CatalogueSearch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  args: { load: async () => ({ rows: [], more: false }) },
}
export const Unavailable: Story = {
  args: {
    load: async () => {
      throw new Error("Example search unavailable")
    },
  },
}
export const Disabled: Story = { args: { disabled: true } }
export const ChooseResult: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("button"))
    const row = await within(document.body).findByRole("button", {
      name: /Northbridge Library/,
    })
    await userEvent.click(row)
    await expect(args.onSelect).toHaveBeenCalledWith({
      documentId: "example-1",
      name: "Northbridge Library",
    })
  },
}
