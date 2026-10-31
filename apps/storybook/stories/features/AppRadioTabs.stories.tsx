import { AppRadioTabs } from "@/components/forms/AppRadioTabs"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { FormExample } from "../../.storybook/FieldExample"

const meta = {
  title: "Features/Forms/AppRadioTabs",
  component: AppRadioTabs,
  args: {
    name: "view",
    label: "Browse libraries",
    tabTriggers: [
      { value: "list", title: "List" },
      { value: "map", title: "Map" },
    ],
    tabsContent: [
      { value: "list", content: "Libraries ordered by name." },
      { value: "map", content: "Libraries grouped by place." },
    ],
  },
  decorators: [
    (Story) => (
      <FormExample values={{ view: "list" }}>
        <Story />
      </FormExample>
    ),
  ],
} satisfies Meta<typeof AppRadioTabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
