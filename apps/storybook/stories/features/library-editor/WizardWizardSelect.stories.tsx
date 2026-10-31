import { WizardSelect } from "@/components/library-editor/WizardFields"
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
          <WizardSelect
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
  title: "Features/Library editor/WizardSelect",
  component: WizardSelect,
  args: {
    label: "Library type",
    id: "libraryType",
    value: "Public",
    onChange: fn(),
    options: [
      { value: "Public", label: "Public" },
      { value: "Mobile", label: "Mobile" },
    ],
  },
} satisfies Meta<typeof WizardSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
