import { WidgetSelectionSources } from "@/components/widgets/WidgetSelectionSources"
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
  title: "Features/Widgets/WidgetSelectionSources",
  component: WidgetSelectionSources,
  parameters: {
    fixtureResponses: widgetResponses,
    docs: { story: { inline: false } },
  },
  render: function Example(supplied) {
    const [, sync] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={sync}>
        {(args, updateArgs) => (
          <WidgetSelectionSources
            {...args}
            update={(spec) => {
              args.update(spec)
              updateArgs({ spec })
            }}
            onRename={(name) => {
              args.onRename(name)
              updateArgs({ name })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  args: {
    team: widgetWorkspace.team,
    spec: selection.spec,
    name: "Example library selection",
    disabled: false,
    resolving: false,
    resolved: widgetData,
    update: fn(),
    onRename: fn(),
    onImportAccess: fn(async () => {}),
    onAddLibrary: fn(),
  },
} satisfies Meta<typeof WidgetSelectionSources>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
