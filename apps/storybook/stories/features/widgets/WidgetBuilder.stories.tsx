import { WidgetBuilder } from "@/components/widgets/WidgetBuilder"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import {
  widgetData,
  widgetWorkspace,
  selection,
  widgetState,
} from "../../fixtures/workspace/widgets"

const meta = {
  title: "Features/Widgets/WidgetBuilder",
  component: WidgetBuilder,
  parameters: { docs: { story: { inline: false, height: "760px" } } },
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, updateArgs) => (
          <WidgetBuilder
            {...args}
            state={{
              ...args.state,
              edit: (patch) => {
                args.state.edit(patch)
                updateArgs({
                  state: {
                    ...args.state,
                    draft: { ...args.state.draft, ...patch },
                  },
                })
              },
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  args: {
    workspace: widgetWorkspace,
    state: widgetState,
    selection,
    resolution: { data: widgetData, error: null, busy: false, retry: fn() },
    busy: false,
    siteUrl: "https://example.invalid",
  },
} satisfies Meta<typeof WidgetBuilder>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
