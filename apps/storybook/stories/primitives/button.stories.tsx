import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Primitives/button",
  component: Button,
  args: {
    children: "Save changes",
    variant: "primary",
    size: "pill",
    disabled: false,
    isLoading: false,
  },
  render: (args) => <Button {...args} />,
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Surface: Story = { args: { variant: "surface" } }
export const CompactPill: Story = { args: { size: "pill-sm" } }
export const Inverse: Story = {
  args: { variant: "inverse", size: "pill-sm", children: "Preview draft" },
  decorators: [
    (Story) => (
      <div className="rounded-2xl bg-[#19172c] p-5">
        <Story />
      </div>
    ),
  ],
}
export const Destructive: Story = {
  args: { variant: "destructive", children: "Delete draft" },
}
export const Disabled: Story = { args: { disabled: true } }
export const Loading: Story = {
  args: { isLoading: true },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Save changes" })
    await expect(button).toBeDisabled()
    await expect(button).toHaveAttribute("aria-busy", "true")
  },
}
export const AsLink: Story = {
  args: {
    asChild: true,
    children: <a href="https://example.invalid">Read guide</a>,
  },
}
export const Icon: Story = {
  args: { size: "icon", "aria-label": "Add library", children: "+" },
}
