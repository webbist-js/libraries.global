import { BeforeYouStartScreen } from "@/components/mobile/live/LiveConsoleScreens"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <BeforeYouStartScreen
            {...args}
            onMode={(mode) => {
              args.onMode?.(mode)
              updateArgs({ mode })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/BeforeYouStartScreen",
  component: BeforeYouStartScreen,
  args: {
    routeLabel: "Northbridge route",
    routeTimes: "09:30–11:45",
    onChangeRoute: fn(),
    mode: "checkins",
    onMode: fn(),
    allowApproximate: true,
    preview: {
      label: "At the stop",
      sentence: "The library is at Market Square until 10:15.",
    },
    checklist: [
      "Park safely before updating the service.",
      "Check that the displayed route is correct.",
    ],
    startLabel: "Start live sharing",
    onStart: fn(),
  },
} satisfies Meta<typeof BeforeYouStartScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
