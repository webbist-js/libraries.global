import { DrawerEdgeTab } from "@/components/ds/DrawerEdgeTab"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

const meta = {
  title: "Patterns/DrawerEdgeTab",
  component: DrawerEdgeTab,
  args: {
    label: "Staff",
    accessibleLabel: "Open the staff drawer",
    title: "Staff drawer (Alt+S)",
    icon: "mdi:account-group-outline",
    onOpen: fn(),
  },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Shared desktop edge-tab presentation. Hosts retain permissions, route visibility, keyboard shortcuts and drawer focus handling. Hidden below the lg breakpoint.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-96 [transform:translateZ(0)] bg-(--t-bg-space)">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DrawerEdgeTab>

export default meta
type Story = StoryObj<typeof meta>

export const Staff: Story = {}
export const Editorial: Story = {
  args: {
    label: "Editorial",
    accessibleLabel: "Open the editorial drawer",
    title: "Editorial drawer (Alt+E)",
    icon: "mdi:feather",
  },
}
export const Both: Story = {
  render: (args) => (
    <>
      <DrawerEdgeTab {...args} />
      <DrawerEdgeTab
        {...args}
        label="Editorial"
        accessibleLabel="Open the editorial drawer"
        title="Editorial drawer (Alt+E)"
        icon="mdi:feather"
        below
      />
    </>
  ),
}
