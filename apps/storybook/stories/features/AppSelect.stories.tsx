import { AppSelect } from "@/components/forms/AppSelect"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { FormExample } from "../../.storybook/FieldExample"

const meta = {
  title: "Features/Forms/AppSelect",
  component: AppSelect,
  args: {
    name: "libraryType",
    label: "Library type",
    placeholder: "Choose a type",
    options: [
      { value: "public", label: "Public" },
      { value: "academic", label: "Academic" },
      { value: "mobile", label: "Mobile" },
    ],
  },
  decorators: [
    (Story) => (
      <FormExample values={{ libraryType: "public" }}>
        <Story />
      </FormExample>
    ),
  ],
} satisfies Meta<typeof AppSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Disabled: Story = { args: { disabled: true } }
