import { DEFAULT_EVENTS_FILTERS } from "@/components/events/event-display"
import { EventsFilterPanel } from "@/components/events/EventsFilterPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Events/EventsFilterPanel",
  component: EventsFilterPanel,
  args: {
    filters: DEFAULT_EVENTS_FILTERS,
    onChange: fn(),
    typeCounts: new Map([
      ["storytime", 4],
      ["workshop", 2],
    ]),
    timeCounts: new Map([
      ["morning", 4],
      ["afternoon", 2],
      ["evening", 1],
      ["allday", 0],
    ]),
    freeCount: 5,
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <EventsFilterPanel
            {...args}
            onChange={(filters) => {
              args.onChange(filters)
              updateArgs({ filters })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof EventsFilterPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
