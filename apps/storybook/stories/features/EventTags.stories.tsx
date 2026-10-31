import { EventTags } from "@/components/events/EventTags"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Events/Tags",
  component: EventTags,
  args: { tags: ["Families", "Local history", "Free entry", "Not shown"] },
  decorators: [
    (Story) => (
      <div className="flex w-80 max-w-full flex-wrap gap-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EventTags>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Families")).toBeVisible()
    await expect(canvas.queryByText("Not shown")).not.toBeInTheDocument()
  },
}
export const Empty: Story = { args: { tags: [] } }
export const Long: Story = {
  args: {
    tags: [
      "An unusually long descriptive event tag that must wrap",
      "Families",
      "Families",
    ],
  },
}
