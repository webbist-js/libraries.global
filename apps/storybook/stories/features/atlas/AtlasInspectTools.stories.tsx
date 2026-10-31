import { AtlasInspectTools } from "@/components/atlas/AtlasInspect"
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
          <AtlasInspectTools
            {...args}
            onShading={(shading) => {
              args.onShading?.(shading)
              updateArgs({ shading })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasInspectTools",
  component: AtlasInspectTools,
  args: {
    about: <p>Synthetic library access data for component review.</p>,
    downloads: <p>Exports use only the synthetic example records.</p>,
    shading: 0.65,
    onShading: fn(),
  },
} satisfies Meta<typeof AtlasInspectTools>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
