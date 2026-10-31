import { TeamApiKeyDialog } from "@/components/staff/TeamApiKeyDialog"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Staff/TeamApiKeyDialog",
  component: TeamApiKeyDialog,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  args: {
    open: false,
    onOpenChange: fn(),
    pending: false,
    disabled: false,
    error: "",
    onCreate: fn(),
    focusSecret: fn(() => false),
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <>
            <Button onClick={() => updateArgs({ open: true })}>
              Create API key
            </Button>
            <TeamApiKeyDialog
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
} satisfies Meta<typeof TeamApiKeyDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Open: Story = {
  args: { open: true },
  parameters: { docs: { story: { inline: false, height: "760px" } } },
}
