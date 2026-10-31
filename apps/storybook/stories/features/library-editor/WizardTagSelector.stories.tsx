import { TagSelector } from "@/components/library-editor/WizardFields"
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
          <TagSelector
            {...args}
            onChange={(value) => {
              args.onChange?.(value)
              updateArgs({ value })
            }}
          />
        )}
      </InteractiveArgs>
    )
  },

  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Library editor/TagSelector",
  component: TagSelector,
  args: {
    label: "Services",
    endpoint: "/api/relations/services",
    value: [],
    onChange: fn(),
  },
} satisfies Meta<typeof TagSelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
