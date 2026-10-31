import { AppFormLabel } from "@/components/forms/AppFormLabel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { FieldExample } from "../../.storybook/FieldExample"

const meta = {
  title: "Features/Forms/AppFormLabel",
  component: AppFormLabel,
  args: { label: "Library name", required: true },
  render: (args) => (
    <FieldExample>
      <AppFormLabel {...args} />
    </FieldExample>
  ),
} satisfies Meta<typeof AppFormLabel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
