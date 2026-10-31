import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Primitives/popover",
  component: Popover,
  args: {},
  render: (args) => (
    <Popover {...args}>
      <PopoverAnchor asChild>
        <PopoverTrigger asChild>
          <Button variant="surface">View source</Button>
        </PopoverTrigger>
      </PopoverAnchor>
      <PopoverContent aria-label="Source details">
        <PopoverHeader>
          <PopoverTitle>Library noticeboard</PopoverTitle>
          <PopoverDescription>Checked on 15 January 2026.</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
} satisfies Meta<typeof Popover>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "View source" }))
  },
}
