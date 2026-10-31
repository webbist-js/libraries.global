import {
  DashboardDrawer,
  DashboardFrame,
  useDashboardOverlay,
} from "@/components/dashboard/DashboardFrame"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { userEvent } from "storybook/test"

const meta = {
  title: "Features/Dashboard/DashboardDrawer",
  component: DashboardDrawer,
  args: {
    panel: "section",
    title: "Workspace sections",
    children: (
      <nav aria-label="Workspace sections">
        <a className="block min-h-11 p-3" href="/staff">
          Your libraries
        </a>
        <a className="block min-h-11 p-3" href="/staff/teams">
          Your Team
        </a>
      </nav>
    ),
  },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  decorators: [
    (Story) => (
      <DashboardFrame navigation={null}>
        <Story />
      </DashboardFrame>
    ),
  ],
  render: function Example(args) {
    const { handleToggle } = useDashboardOverlay()

    return (
      <>
        <Button
          onClick={(event) => handleToggle(args.panel, event.currentTarget)}
        >
          Open workspace sections
        </Button>
        <DashboardDrawer {...args} />
      </>
    )
  },
} satisfies Meta<typeof DashboardDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Open: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Open workspace sections" })
    )
  },
}
