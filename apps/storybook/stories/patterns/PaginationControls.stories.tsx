import { PaginationControls } from "@/components/ds/PaginationControls"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn, expect } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Patterns/PaginationControls",
  component: PaginationControls,
  args: { page: 0, pageCount: 12, disabled: false, onPage: fn() },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <PaginationControls
            {...args}
            onPage={(page) => {
              args.onPage(page)
              updateArgs({ page })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof PaginationControls>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Middle: Story = { args: { page: 5 } }
export const Last: Story = { args: { page: 11 } }
export const SinglePage: Story = { args: { pageCount: 1 } }
export const Disabled: Story = { args: { disabled: true } }
export const Navigate: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }))
    await expect(args.onPage).toHaveBeenCalledWith(1)
    await expect(
      canvas.getByRole("button", { name: "Page 2" })
    ).toHaveAttribute("aria-current", "page")
  },
}
