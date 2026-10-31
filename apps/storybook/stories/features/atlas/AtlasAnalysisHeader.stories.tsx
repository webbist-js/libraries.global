import { AtlasAnalysisHeader } from "@/components/atlas/AtlasAnalysisHeader"
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
          <AtlasAnalysisHeader
            {...args}
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
  title: "Features/Atlas/AtlasAnalysisHeader",
  component: AtlasAnalysisHeader,
  args: {
    title: "Library access",
    badge: "Analysis",
    description:
      "Compare recorded libraries with synthetic population figures.",
    collapsed: false,
    onCollapse: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof AtlasAnalysisHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Collapsed: Story = { args: { collapsed: true } }
