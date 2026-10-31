import { AtlasAccessibilityAnalysis } from "@/components/atlas/AtlasAccessibilityAnalysis"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { atlasLibraries } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasAccessibilityAnalysis
            {...args}
            onSelected={(selected) => {
              args.onSelected?.(selected)
              updateArgs({ selected })
            }}
            onView={(view) => {
              args.onView?.(view)
              updateArgs({ view })
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
  title: "Features/Atlas/AtlasAccessibilityAnalysis",
  component: AtlasAccessibilityAnalysis,
  args: {
    tier: "pro",
    enabled: true,
    libraries: atlasLibraries,
    selected: ["Step-free entrance"],
    view: "matches",
    coverage: { total: 2, matches: 1, partial: 0, unconfirmed: 1 },
    scope: "Northbridge",
    serverOptions: [{ name: "Step-free entrance", count: 1 }],
    onSelected: fn(),
    onView: fn(),
    onEnable: fn(),
    onSignIn: fn(),
    collapsed: false,
    onCollapse: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof AtlasAccessibilityAnalysis>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Public: Story = { args: { tier: "public", enabled: false } }
