import { EditorialToolbar } from "@/components/ds/EditorialToolbar"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/EditorialToolbar",
  component: EditorialToolbar,
  argTypes: { actions: { control: false } },
  args: {
    label: "Editorial review",
    description: "This draft is awaiting review.",
    variant: "subtle",
    actions: <Button variant="surface">Preview draft</Button>,
  },
} satisfies Meta<typeof EditorialToolbar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Dark: Story = { args: { variant: "dark" } }
