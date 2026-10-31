import { AtlasAnalysisWorkspace } from "@/components/atlas/AtlasAnalysisWorkspace"
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
          <AtlasAnalysisWorkspace
            {...args}
            onTab={(tab) => {
              args.onTab?.(tab)
              updateArgs({ tab })
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

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasAnalysisWorkspace",
  component: AtlasAnalysisWorkspace,
  args: {
    title: "Library access",
    badge: "Analysis",
    description: "Compare recorded libraries in Northbridge.",
    collapsed: false,
    onCollapse: fn(),
    onClose: fn(),
    tab: "overview",
    onTab: fn(),
    children: <p>Two libraries serve the example district.</p>,
  },
} satisfies Meta<typeof AtlasAnalysisWorkspace>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
