import { AtlasAccessAnalysis } from "@/components/atlas/AtlasAccessAnalysis"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { accessResponse } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasAccessAnalysis
            {...args}
            onOpacity={(opacity) => {
              args.onOpacity?.(opacity)
              updateArgs({ opacity })
            }}
            onTab={(tab) => {
              args.onTab?.(tab)
              updateArgs({ tab })
            }}
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
  title: "Features/Atlas/AtlasAccessAnalysis",
  component: AtlasAccessAnalysis,
  args: {
    response: accessResponse,
    metric: "per100k",
    selected: "example-district",
    onSelect: fn(),
    onFit: fn(),
    onClose: fn(),
    collapsed: false,
    onCollapse: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof AtlasAccessAnalysis>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { response: undefined } }
export const Collapsed: Story = { args: { collapsed: true } }
