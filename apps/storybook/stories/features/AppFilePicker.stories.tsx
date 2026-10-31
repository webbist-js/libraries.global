import { AppFilePicker } from "@/components/forms/AppFilePicker"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useArgs } from "storybook/preview-api"
import { fn } from "storybook/test"

import { FormExample } from "../../.storybook/FieldExample"
import { InteractiveArgs } from "../../.storybook/InteractiveArgs"

const meta = {
  title: "Features/Forms/AppFilePicker",
  component: AppFilePicker,
  args: {
    selectedFile: null,
    setSelectedFile: fn(),
    label: "Library photograph",
    validTypes: ["image/png", "image/jpeg"],
  },
  render: function Render(supplied) {
    const [, syncControls] = useArgs()

    return (
      <InteractiveArgs args={supplied} onUpdate={syncControls}>
        {(args, updateArgs) => (
          <FormExample>
            <AppFilePicker
              {...args}
              setSelectedFile={(selectedFile) => {
                args.setSelectedFile(selectedFile)
                updateArgs({ selectedFile })
              }}
            />
          </FormExample>
        )}
      </InteractiveArgs>
    )
  },
} satisfies Meta<typeof AppFilePicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
