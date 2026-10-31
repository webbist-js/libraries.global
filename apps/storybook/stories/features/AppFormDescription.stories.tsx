import { AppFormDescription } from "@/components/forms/AppFormDescription"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { FieldExample } from "../../.storybook/FieldExample"

const meta = {
  title: "Features/Forms/AppFormDescription",
  component: AppFormDescription,
  args: { description: "Use the name displayed on the library’s own website." },
  render: (args) => (
    <FieldExample>
      <AppFormDescription {...args} />
    </FieldExample>
  ),
} satisfies Meta<typeof AppFormDescription>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
