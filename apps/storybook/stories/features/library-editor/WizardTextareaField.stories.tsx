import { TextareaField } from "@/components/library-editor/WizardFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <TextareaField
            {...args}
            onChange={(key, value) => {
              args.onChange(key, value)
              updateArgs({ value })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/TextareaField",
  component: TextareaField,
  args: {
    label: "About this library",
    id: "summary",
    value: "A welcoming community library with accessible reading rooms.",
    onChange: fn(),
    rows: 4,
  },
} satisfies Meta<typeof TextareaField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
