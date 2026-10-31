import { ChoiceCard } from "@/components/ds/ChoiceCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Patterns/ChoiceCard",
  component: ChoiceCard,
  args: {
    name: "contribution",
    value: "correction",
    checked: false,
    onChange: fn(),
    title: "Correct a record",
    hint: "Update details with a reliable source.",
    icon: "mdi:pencil-outline",
    tint: { bg: "var(--t-accent-chip)", fg: "var(--t-accent-primary)" },
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <fieldset>
            <legend className="mb-3">How would you like to help?</legend>
            <ChoiceCard
              {...args}
              onChange={() => {
                args.onChange()
                updateArgs({ checked: true })
              }}
            />
          </fieldset>
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof ChoiceCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Selected: Story = { args: { checked: true } }
