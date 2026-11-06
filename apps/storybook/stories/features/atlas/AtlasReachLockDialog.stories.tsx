import { AtlasReachLockDialog } from "@/components/atlas/AtlasReachLockDialog"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Atlas/AtlasReachLockDialog",
  component: AtlasReachLockDialog,
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <>
            <Button onClick={() => updateArgs({ open: true })}>
              Use Reach
            </Button>
            <AtlasReachLockDialog
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
  args: {
    open: true,
    scope: "library",
    signedIn: true,
    onOpenChange: fn(),
    onSignIn: fn(),
  },
  argTypes: {
    scope: { control: "inline-radio", options: ["library", "service"] },
  },
  parameters: { docs: { story: { inline: false } } },
} satisfies Meta<typeof AtlasReachLockDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Signed in without an accepted contribution: both routes to Reach. */
export const Default: Story = {}
/** Signed out: contributing needs a free account first. */
export const SignedOut: Story = { args: { signedIn: false } }
/** Reach for a whole library service is API Access only. */
export const Service: Story = { args: { scope: "service" } }
