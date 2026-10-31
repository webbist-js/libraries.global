import { DataTable } from "@/components/elementary/data-table/DataTable"
import { DataTableColumnHeader } from "@/components/elementary/data-table/DataTableColumnHeader"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { ComponentProps } from "react"
import { expect } from "storybook/test"

type Row = { name: string; type: string; town: string }
const rows: Row[] = [
  { name: "Northbridge Library", type: "Public", town: "Northbridge" },
  { name: "Eastmere Reading Room", type: "Academic", town: "Eastmere" },
  { name: "Westhaven Mobile Library", type: "Mobile", town: "Westhaven" },
]
type Args = {
  data: Row[]
  isLoading: boolean
  allowSearching: boolean
  withDropdown: boolean
  pagination: "simple" | "extended" | false
}
const meta = {
  title: "Patterns/Data table",
  args: {
    data: rows,
    isLoading: false,
    allowSearching: true,
    withDropdown: false,
    pagination: "extended",
  },
  render: function Example(args) {
    const columns: ComponentProps<typeof DataTable<Row, unknown>>["columns"] = [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Library"
            withDropdown={args.withDropdown}
          />
        ),
      },
      { accessorKey: "type", header: "Type" },
      { accessorKey: "town", header: "Town" },
    ]

    return <DataTable {...args} columns={columns} />
  },
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { data: [] } }
export const Loading: Story = { args: { isLoading: true } }
export const HeaderMenu: Story = { args: { withDropdown: true } }
export const Filter: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("textbox"), "Eastmere")
    await expect(canvas.getByText("Eastmere Reading Room")).toBeVisible()
    await expect(
      canvas.queryByText("Northbridge Library")
    ).not.toBeInTheDocument()
  },
}
