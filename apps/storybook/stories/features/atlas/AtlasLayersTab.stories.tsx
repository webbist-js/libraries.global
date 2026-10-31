import { AtlasLayersTab } from "@/components/atlas/AtlasLayersTab"
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
          <AtlasLayersTab
            {...args}
            onHeatOpacity={(heatOpacity) => {
              args.onHeatOpacity?.(heatOpacity)
              updateArgs({ heatOpacity })
            }}
            onMobileRouteLines={(mobileRouteLines) => {
              args.onMobileRouteLines?.(mobileRouteLines)
              updateArgs({ mobileRouteLines })
            }}
            onMobileOpacity={(mobileOpacity) => {
              args.onMobileOpacity?.(mobileOpacity)
              updateArgs({ mobileOpacity })
            }}
            onSettings={(settings) => {
              args.onSettings?.(settings)
              updateArgs({ settings })
            }}
            onToggle={(id) => {
              args.onToggle(id)
              updateArgs({
                active: args.active.includes(id)
                  ? args.active.filter((item) => item !== id)
                  : [...args.active, id],
              })
            }}
            onClear={() => {
              args.onClear()
              updateArgs({ active: [] })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasLayersTab",
  component: AtlasLayersTab,
  args: {
    tier: "pro",
    active: ["pins"],
    onAccessibilityAnalysis: fn(),
    onToggle: fn(),
    onClear: fn(),
    heatOpacity: 0.65,
    onHeatOpacity: fn(),
    onSignIn: fn(),
    onSeePlans: fn(),
  },
} satisfies Meta<typeof AtlasLayersTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Public: Story = { args: { tier: "public" } }
