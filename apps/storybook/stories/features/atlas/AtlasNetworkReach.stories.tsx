import { AtlasNetworkReach } from "@/components/atlas/AtlasNetworkReach"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { networkSelection, reachResult } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasNetworkReach
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
            onNetwork={(networkId) => {
              args.onNetwork?.(networkId)
              updateArgs({ networkId })
            }}
            onGaps={(gaps) => {
              args.onGaps?.(gaps)
              updateArgs({ gaps })
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
  title: "Features/Atlas/AtlasNetworkReach",
  component: AtlasNetworkReach,
  args: {
    selection: networkSelection,
    retrySelection: fn(),
    networkId: "example-network",
    onNetwork: fn(),
    minutes: 15,
    onMinutes: fn(),
    mode: "walking",
    onMode: fn(),
    response: reachResult,
    calculate: fn(),
    canExport: false,
    gaps: false,
    onGaps: fn(),
    filterCount: 0,
    onClearFilters: fn(),
  },
} satisfies Meta<typeof AtlasNetworkReach>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ReadyToCalculate: Story = { args: { response: null } }
