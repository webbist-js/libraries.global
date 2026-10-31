import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Primitives/alert",
  component: Alert,
  args: { variant: "default" },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Check your source</AlertTitle>
      <AlertDescription>
        Include a reference before submitting this change.
      </AlertDescription>
    </Alert>
  ),
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Destructive: Story = { args: { variant: "destructive" } }
