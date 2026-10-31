import { WidgetSelectionFilters } from "@/components/widgets/WidgetSelectionFilters"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  widgetData,
  widgetWorkspace,
  selection,
  widgetResponses,
} from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetSelectionFilters",
  component: WidgetSelectionFilters,
  parameters: {
    fixtureResponses: widgetResponses,
    docs: { story: { inline: false } },
  },
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, updateArgs) => (
          <WidgetSelectionFilters
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
    team: widgetWorkspace.team,
    spec: selection.spec,
    update: fn(),
    disabled: false,
    resolved: widgetData,
  },
} satisfies Meta<typeof WidgetSelectionFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
