import { IndexPager } from "@/components/ds/IndexPager"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { expect, fn } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Patterns/IndexPager",
  component: IndexPager,
  args: { page: 1, totalPages: 12, onPageChange: fn() },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <IndexPager
            {...args}
            onPageChange={(page) => {
              args.onPageChange(page)
              updateArgs({ page })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof IndexPager>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Middle: Story = { args: { page: 6 } }
export const SinglePage: Story = { args: { totalPages: 1 } }

export const Navigate: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }))
    await expect(args.onPageChange).toHaveBeenCalledWith(2)
    await expect(
      canvas.getByRole("button", { name: "Page 2" })
    ).toHaveAttribute("aria-current", "page")
  },
}
