import { WidgetSettingsPanel } from "@/components/widgets/WidgetSettingsPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { widgetWorkspace, widgetState } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetSettingsPanel",
  component: WidgetSettingsPanel,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, updateArgs) => (
          <WidgetSettingsPanel
            {...args}
            edit={(patch) => {
              args.edit(patch)
              updateArgs({ draft: { ...args.draft, ...patch } })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  args: {
    draft: widgetState.draft,
    team: widgetWorkspace.team,
    busy: false,
    edit: fn(),
  },
} satisfies Meta<typeof WidgetSettingsPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
