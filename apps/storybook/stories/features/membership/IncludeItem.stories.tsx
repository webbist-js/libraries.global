import { IncludeItem } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanBits"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/IncludeItem",
  component: IncludeItem,
  decorators: [
    (Story) => (
      <ul className="m-0 list-none p-0">
        <Story />
      </ul>
    ),
  ],
  args: { item: { text: "Save and follow libraries", kind: "feature" } },
} satisfies Meta<typeof IncludeItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Planned: Story = {
  args: { item: { text: "More sharing options", kind: "soon" } },
}
