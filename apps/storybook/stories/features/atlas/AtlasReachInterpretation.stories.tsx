import { AtlasReachInterpretation } from "@/components/atlas/AtlasReachInterpretation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { reachResult } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasReachInterpretation
            {...args}
            onMinutes={(minutes) => {
              args.onMinutes?.(minutes)
              updateArgs({ minutes })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasReachInterpretation",
  component: AtlasReachInterpretation,
  args: { result: reachResult, minutes: 15, onMinutes: fn() },
} satisfies Meta<typeof AtlasReachInterpretation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
