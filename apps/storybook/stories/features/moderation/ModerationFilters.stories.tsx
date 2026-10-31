import { ModerationFilters } from "@/components/moderation/ModerationFilters"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Moderation/ModerationFilters",
  component: ModerationFilters,
  args: {
    value: { segment: "pending", queue: "", locale: "", q: "", drive: "" },
    queues: ["index", "journal", "knowledge", "applications"],
    locales: [
      { code: "en", name: "English" },
      { code: "fr", name: "French" },
    ],
    counts: { pending: 8, needs_info: 2, decided: 14 },
    onChange: fn(),
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <ModerationFilters
            {...args}
            onChange={(patch) => {
              args.onChange(patch)
              updateArgs({ value: { ...args.value, ...patch } })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof ModerationFilters>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
