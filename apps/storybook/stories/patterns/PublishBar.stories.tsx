import { PublishBar } from "@/components/ds/PublishBar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn, expect } from "storybook/test"

const meta = {
  title: "Patterns/PublishBar",
  component: PublishBar,
  args: { count: 3, busy: false, onDiscard: fn(), onPublish: fn() },
} satisfies Meta<typeof PublishBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Quiet: Story = { args: { count: 0 } }
export const Published: Story = {
  args: { count: 0, status: "Changes published." },
}
export const Busy: Story = { args: { busy: true } }
export const Publish: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Publish changes" })
    )
    await expect(args.onPublish).toHaveBeenCalledTimes(1)
  },
}
