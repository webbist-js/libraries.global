import { WidgetSelectedLibraries } from "@/components/widgets/WidgetSelectedLibraries"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { widgetData, selection } from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetSelectedLibraries",
  component: WidgetSelectedLibraries,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, updateArgs) => (
          <WidgetSelectedLibraries
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
    publicRows: widgetData.rows,
    disabled: false,
    update: fn(),
    names: new Map([["example-library", "Northbridge Library"]]),
    resolving: false,
    unresolvedIds: [],
  },
} satisfies Meta<typeof WidgetSelectedLibraries>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
