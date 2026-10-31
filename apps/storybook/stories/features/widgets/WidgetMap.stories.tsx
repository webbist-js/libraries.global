import WidgetMap from "@/components/widgets/WidgetMap"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { widgetData } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetMap",
  component: WidgetMap,
  args: {
    rows: widgetData.rows,
    selected: null,
    onSelect: fn(),
    accent: "#4338ca",
    clusters: true,
    labels: true,
    reset: true,
  },
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, update) => (
          <div style={{ height: 480 }}>
            <WidgetMap
              {...args}
              onSelect={(selected) => {
                args.onSelect(selected)
                update({ selected })
              }}
            />
          </div>
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof WidgetMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
