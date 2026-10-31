import { VisibilityCards } from "@/components/settings/VisibilityCards"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Settings/VisibilityCards",
  component: VisibilityCards,
  args: { value: "public", onChange: fn() },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <VisibilityCards
            {...args}
            onChange={(value) => {
              args.onChange(value)
              updateArgs({ value })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof VisibilityCards>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Private: Story = { args: { value: "private" } }
