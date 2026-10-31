import { AppTextArea } from "@/components/forms/AppTextArea"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { FormExample } from "../../.storybook/FieldExample"

const meta = {
  title: "Features/Forms/AppTextArea",
  component: AppTextArea,
  args: {
    name: "description",
    label: "About the library",
    description:
      "Help visitors understand the library’s collections and services.",
  },
  decorators: [
    (Story) => (
      <FormExample
        values={{
          description:
            "A welcoming community library with accessible reading rooms.",
        }}
      >
        <Story />
      </FormExample>
    ),
  ],
} satisfies Meta<typeof AppTextArea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Required: Story = { args: { required: true } }
