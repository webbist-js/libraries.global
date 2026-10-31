import { StopDrawer } from "@/components/mobile/StopDrawer"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { timetable } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  title: "Features/Mobile/StopDrawer",
  component: StopDrawer,
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <>
            <Button onClick={() => updateArgs({ stopId: "example-market" })}>
              Show stop details
            </Button>
            <StopDrawer
              {...args}
              onClose={() => {
                args.onClose()
                updateArgs({ stopId: null })
              }}
            />
          </>
        )}
      </InteractiveArgs>
    )
  },
  args: {
    id: "example-mobile",
    name: "Northbridge Mobile Library",
    tt: timetable,
    notices: [],
    timezone: "Europe/London",
    stopId: null,
    onClose: fn(),
  },
  parameters: {
    fixtureResponses: geographyResponses,
  },
} satisfies Meta<typeof StopDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Closed: Story = { args: { stopId: null } }

export const Open: Story = {
  args: { stopId: "example-market" },
  parameters: { docs: { story: { inline: false, height: "650px" } } },
}
