import { TeamCheckoutDialog } from "@/components/staff/TeamCheckoutDialog"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Staff/TeamCheckoutDialog",
  component: TeamCheckoutDialog,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  args: {
    open: false,
    onOpenChange: fn(),
    initialSeats: 5,
    sandbox: true,
    busy: false,
    error: "",
    onCheckout: fn(),
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <>
            <Button onClick={() => updateArgs({ open: true })}>
              Set up your Team
            </Button>
            <TeamCheckoutDialog
              {...args}
              onOpenChange={(open) => {
                args.onOpenChange(open)
                updateArgs({ open })
              }}
            />
          </>
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof TeamCheckoutDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Open: Story = {
  args: { open: true },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
}
