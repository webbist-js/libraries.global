import { AtlasAreaPicker } from "@/components/atlas/AtlasAreaPicker"
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
          <AtlasAreaPicker
            {...args}
            onSelect={(selected) => {
              args.onSelect?.(selected)
              updateArgs({ selected })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasAreaPicker",
  component: AtlasAreaPicker,
  args: {
    selected: null,
    onSelect: fn(),
    areas: [
      {
        id: "example-district",
        name: "Northbridge",
        detail: "Example district",
      },
    ],
  },
} satisfies Meta<typeof AtlasAreaPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
