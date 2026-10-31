import { ViewToggle } from "@/components/atlas/AtlasBottomBar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/ViewToggle",
  component: ViewToggle,
  args: { list: false, onChange: fn() },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <ViewToggle
            {...args}
            onChange={(list) => {
              args.onChange(list)
              updateArgs({ list })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof ViewToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
