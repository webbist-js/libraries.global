import { AtlasContextAnalysis } from "@/components/atlas/AtlasContext"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { contextRelease } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasContextAnalysis
            {...args}
            onOpacity={(opacity) => {
              args.onOpacity?.(opacity)
              updateArgs({ opacity })
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
  title: "Features/Atlas/AtlasContextAnalysis",
  component: AtlasContextAnalysis,
  args: {
    theme: "carAccess",
    releases: [contextRelease],
    release: contextRelease,
    onRelease: fn(),
    loading: false,
    error: false,
    retry: fn(),
    onArea: fn(),
    opacity: 0.65,
    onOpacity: fn(),
    onClose: fn(),
    collapsed: false,
    onCollapse: fn(),
    reachActive: false,
    onReach: fn(),
  },
} satisfies Meta<typeof AtlasContextAnalysis>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = { args: { loading: true } }
export const Unavailable: Story = { args: { error: true } }
