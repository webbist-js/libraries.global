import { ConfirmIdentity } from "@/components/mobile/live/ConfirmIdentity"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  title: "Features/Mobile/ConfirmIdentity",
  component: ConfirmIdentity,
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <>
            <Button onClick={() => updateArgs({ open: true })}>
              Confirm your identity
            </Button>
            <ConfirmIdentity
              {...args}
              onClose={() => {
                args.onClose()
                updateArgs({ open: false })
              }}
            />
          </>
        )}
      </InteractiveArgs>
    )
  },
  args: { open: false, onClose: fn(), onConfirmed: fn() },
  parameters: {
    fixtureResponses: geographyResponses,
  },
} satisfies Meta<typeof ConfirmIdentity>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Closed: Story = { args: { open: false } }

export const Open: Story = {
  args: { open: true },
  parameters: { docs: { story: { inline: false, height: "650px" } } },
}
