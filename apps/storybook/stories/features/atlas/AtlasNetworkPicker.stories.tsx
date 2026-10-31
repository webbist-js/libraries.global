import { AtlasNetworkPicker } from "@/components/atlas/AtlasNetworkPicker"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { networkSelection } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <AtlasNetworkPicker
            {...args}
            onChange={(value) => {
              args.onChange?.(value)
              updateArgs({ value })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasNetworkPicker",
  component: AtlasNetworkPicker,
  args: {
    value: "example-network",
    selected: networkSelection,
    onChange: fn(),
  },
} satisfies Meta<typeof AtlasNetworkPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
