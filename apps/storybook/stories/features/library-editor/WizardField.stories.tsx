import { Field } from "@/components/library-editor/WizardFields"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { expect, fn, userEvent, within } from "storybook/test"

import { InteractiveArgs } from "../../../.storybook/InteractiveArgs"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <Field
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
  title: "Features/Library editor/Field",
  component: Field,
  args: {
    label: "Library name",
    id: "name",
    value: "Northbridge Community Library",
    onChange: fn(),
    hint: "Use the name displayed on the library website.",
    required: true,
  },
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const input = within(canvasElement).getByRole("textbox", {
      name: /Library name/,
    })
    await userEvent.clear(input)
    await userEvent.type(input, "Riverside Library")
    await expect(input).toHaveValue("Riverside Library")
    await expect(args.onChange).toHaveBeenLastCalledWith(
      "name",
      "Riverside Library"
    )
  },
}
export const Invalid: Story = { args: { errorText: "Add a library name." } }
