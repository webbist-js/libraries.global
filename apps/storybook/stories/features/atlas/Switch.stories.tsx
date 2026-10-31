import { Switch } from "@/components/atlas/atlas-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/Switch",
  component: Switch,
  args: { checked: false, onChange: fn(), label: "Library locations" },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <Switch
            {...args}
            onChange={() => {
              args.onChange()
              updateArgs({ checked: !args.checked })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
