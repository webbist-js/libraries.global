import { TimetableEditor } from "@/components/mobile/TimetableEditor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { timetable } from "../../fixtures/geography/mobile"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Mobile/TimetableEditor",
  component: TimetableEditor,
  args: {
    value: timetable,
    onChange: fn(),
    notices: [],
    timezone: "Europe/London",
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <TimetableEditor
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
} satisfies Meta<typeof TimetableEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { value: null } }
export const Disabled: Story = { args: { disabled: true } }
