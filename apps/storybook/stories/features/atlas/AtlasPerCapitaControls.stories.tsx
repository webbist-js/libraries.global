import { AtlasPerCapitaControls } from "@/components/atlas/AtlasPerCapita"
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
          <AtlasPerCapitaControls
            {...args}
            onMetric={(metric) => {
              args.onMetric?.(metric)
              updateArgs({ metric })
            }}
            onLevel={(level) => {
              args.onLevel?.(level)
              updateArgs({ level })
            }}
            onOpacity={(opacity) => {
              args.onOpacity?.(opacity)
              updateArgs({ opacity })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasPerCapitaControls",
  component: AtlasPerCapitaControls,
  args: {
    metric: "per100k",
    onMetric: fn(),
    level: "auto",
    onLevel: fn(),
    resolvedLevel: "local",
    opacity: 0.65,
    onOpacity: fn(),
    types: [],
    onTypes: fn(),
    onAnalysis: fn(),
  },
} satisfies Meta<typeof AtlasPerCapitaControls>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
