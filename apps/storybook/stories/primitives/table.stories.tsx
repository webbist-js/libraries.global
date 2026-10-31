import {
  Table,
  TableCaption,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableFooter,
} from "@/components/ui/table"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Primitives/table",
  component: Table,
  args: {},
  render: (args) => (
    <Table {...args}>
      <TableCaption>Example library opening times</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Day</TableHead>
          <TableHead scope="col">Opening times</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Monday</TableCell>
          <TableCell>09:00–18:00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Tuesday</TableCell>
          <TableCell>Closed</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableHead scope="row">Open days shown</TableHead>
          <TableCell>1</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
} satisfies Meta<typeof Table>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
