import { AppCheckbox } from "@/components/forms/AppCheckbox"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { FormExample } from "../../.storybook/FieldExample"

const meta = {
  title: "Features/Forms/AppCheckbox",
  component: AppCheckbox,
  args: {
    name: "updates",
    label: "Weekly library updates",
    description: "Receive a summary of changes at your library.",
  },
  decorators: [
    (Story) => (
      <FormExample values={{ updates: false }}>
        <Story />
      </FormExample>
    ),
  ],
} satisfies Meta<typeof AppCheckbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
