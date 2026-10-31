import { StaffPanel } from "@/components/staff/StaffPanel"
import { TeamSeatUsage } from "@/components/staff/TeamSeatUsage"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"
import { fn } from "storybook/test"

const meta = {
  title: "Features/Staff/StaffPanel",
  component: StaffPanel,
  render: function Example(args) {
    const id = useId()

    return <StaffPanel {...args} id={`${args.id ?? "example"}-${id}`} />
  },
  args: {
    id: "example-staff-panel",
    title: "Members",
    children: (
      <p className="m-0 text-(--t-ink-dim)">
        Invite colleagues and assign their library access.
      </p>
    ),
    compact: false,
  },
  argTypes: {
    children: { control: false },
    aside: { control: false },
    footer: { control: false },
  },
} satisfies Meta<typeof StaffPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const CompactSummary: Story = {
  args: {
    title: "Your seats",
    compact: true,
    children: <TeamSeatUsage used={1} total={5} />,
  },
}
export const HeaderAndFooterActions: Story = {
  args: {
    aside: <span className="text-sm text-(--t-ink-dim)">1 of 5 seats</span>,
    footer: (
      <Button variant="surface" size="pill" onClick={fn()}>
        Invite a colleague
      </Button>
    ),
  },
}
export const NarrowLongTitle: Story = {
  args: {
    title: "Example Library Team members and library assignments",
    aside: <span>5 members</span>,
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
}
