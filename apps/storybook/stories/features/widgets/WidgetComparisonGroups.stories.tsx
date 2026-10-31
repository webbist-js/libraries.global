import { WidgetComparisonGroups } from "@/components/widgets/WidgetComparisonGroups"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { widgetData, selection } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetComparisonGroups",
  component: WidgetComparisonGroups,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, updateArgs) => (
          <WidgetComparisonGroups
            {...args}
            update={(spec) => {
              args.update(spec)
              updateArgs({ spec })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  args: {
    spec: selection.spec,
    rows: widgetData.rows,
    disabled: false,
    update: fn(),
  },
} satisfies Meta<typeof WidgetComparisonGroups>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
