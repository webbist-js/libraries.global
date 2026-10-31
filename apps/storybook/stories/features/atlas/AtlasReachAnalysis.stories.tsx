import { AtlasReachAnalysis } from "@/components/atlas/AtlasReach"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { atlasLibraries, reachResult } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasReachAnalysis
            {...args}
            onOpacity={(opacity) => {
              args.onOpacity?.(opacity)
              updateArgs({ opacity })
            }}
            onMode={(mode) => {
              args.onMode?.(mode)
              updateArgs({ mode })
            }}
            onMinutes={(minutes) => {
              args.onMinutes?.(minutes)
              updateArgs({ minutes })
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
  title: "Features/Atlas/AtlasReachAnalysis",
  component: AtlasReachAnalysis,
  args: {
    library: atlasLibraries[0]!,
    response: reachResult,
    error: null,
    retry: fn(),
    mode: "walking",
    onMode: fn(),
    minutes: 15,
    onMinutes: fn(),
    opacity: 0.65,
    onOpacity: fn(),
    onClose: fn(),
    collapsed: false,
    onCollapse: fn(),
    canExport: false,
  },
} satisfies Meta<typeof AtlasReachAnalysis>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Pending: Story = { args: { response: null } }
