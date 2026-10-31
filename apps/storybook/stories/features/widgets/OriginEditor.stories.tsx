import { OriginEditor } from "@/components/widgets/WidgetPublish"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Widgets/OriginEditor",
  component: OriginEditor,
  args: {
    initial: ["https://example.invalid"],
    onChange: fn(),
    disabled: false,
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <OriginEditor
            {...args}
            onChange={(initial) => {
              args.onChange(initial)
              updateArgs({ initial })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof OriginEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
