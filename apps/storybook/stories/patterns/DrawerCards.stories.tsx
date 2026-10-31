import {
  DrawerSection,
  DrawerAction,
  DrawerFooter,
  DrawerTile,
  DrawerLinkCard,
} from "@/components/ds/DrawerCards"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"
import { fn } from "storybook/test"

const meta = {
  title: "Patterns/Drawer cards",
  component: DrawerSection,
  args: {
    id: "library-shortcuts",
    title: "Manage your library",
    description: "Shortcuts for verified staff",
    children: null,
  },
} satisfies Meta<typeof DrawerSection>

export default meta
type Story = StoryObj<typeof meta>

export const Actions: Story = {
  render: function Example(args) {
    const id = useId()

    return (
      <DrawerSection {...args} id={`${args.id}-${id}`}>
        <DrawerAction
          href="/staff"
          icon="mdi:library-outline"
          label="Record details"
          count={3}
        />
        <DrawerAction
          href="/staff/analytics"
          icon="mdi:chart-bar"
          label="Analytics"
          description="Understand your library’s reach"
          tag="Team"
        />
      </DrawerSection>
    )
  },
}
export const Tiles: Story = {
  render: function Example(args) {
    const id = useId()

    return (
      <DrawerSection {...args} id={`${args.id}-${id}`}>
        <div className="grid grid-cols-2 gap-3">
          <DrawerTile
            href="/staff"
            icon="mdi:library-outline"
            label="Record details"
          />
          <DrawerTile
            href="/staff/routes"
            icon="mdi:bus-side"
            label="Routes"
            tag="Mobile"
          />
        </div>
      </DrawerSection>
    )
  },
}
export const LinkCard: Story = {
  render: () => (
    <DrawerLinkCard
      href="/knowledge/contributing"
      title="Staff contribution guide"
      description="How to maintain your library record"
    />
  ),
}
export const Footer: Story = {
  render: () => (
    <DrawerFooter
      href="/staff"
      label="Open workspace"
      shortcut="Esc"
      onClose={fn()}
    />
  ),
}
