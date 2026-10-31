import { AtlasPopulationDensityAnalysis } from "@/components/atlas/AtlasPopulationDensity"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { populationResponse } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasPopulationDensityAnalysis
            {...args}
            onSelect={(selected) => {
              args.onSelect?.(selected)
              updateArgs({ selected })
            }}
            onCollapse={() => {
              args.onCollapse?.()
              updateArgs({ collapsed: !args.collapsed })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
  },
  title: "Features/Atlas/AtlasPopulationDensityAnalysis",
  component: AtlasPopulationDensityAnalysis,
  args: {
    response: populationResponse,
    selected: "example-district",
    onSelect: fn(),
    error: null,
    retry: fn(),
    onClose: fn(),
    collapsed: false,
    onCollapse: fn(),
  },
} satisfies Meta<typeof AtlasPopulationDensityAnalysis>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { response: null, loading: true } }
