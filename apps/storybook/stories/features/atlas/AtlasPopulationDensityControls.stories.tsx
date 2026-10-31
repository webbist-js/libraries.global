import { AtlasPopulationDensityControls } from "@/components/atlas/AtlasPopulationDensity"
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
          <AtlasPopulationDensityControls
            {...args}
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
  title: "Features/Atlas/AtlasPopulationDensityControls",
  component: AtlasPopulationDensityControls,
  args: { level: "local", onLevel: fn(), opacity: 0.65, onOpacity: fn() },
} satisfies Meta<typeof AtlasPopulationDensityControls>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
