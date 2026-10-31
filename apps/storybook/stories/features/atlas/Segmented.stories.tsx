import { Segmented } from "@/components/atlas/atlas-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/Segmented",
  component: Segmented,
  args: {
    value: "map",
    options: [
      { value: "map", label: "Map", icon: "map" },
      { value: "list", label: "List", icon: "list" },
    ],
    onChange: fn(),
    label: "View",
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <Segmented
            {...args}
            onChange={(value) => {
              args.onChange(value)
              updateArgs({ value })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof Segmented>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
