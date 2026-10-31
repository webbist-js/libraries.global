import { FeedValuesFields } from "@/components/event-feeds/FeedValuesFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Event feeds/FeedValuesFields",
  component: FeedValuesFields,
  args: {
    provider: "ical",
    values: { url: "https://example.invalid/library.ics" },
    onChange: fn(),
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <FeedValuesFields
            {...args}
            onChange={(values) => {
              args.onChange(values)
              updateArgs({ values })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof FeedValuesFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Eventbrite: Story = {
  args: { provider: "eventbrite", values: {} },
}
export const TicketSource: Story = {
  args: { provider: "ticketsource", values: {} },
}
