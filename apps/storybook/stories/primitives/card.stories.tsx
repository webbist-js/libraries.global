import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardAction,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Primitives/card",
  component: Card,
  args: {},
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardAction>
          <Button variant="ghost" size="icon" aria-label="More card options">
            ⋯
          </Button>
        </CardAction>
        <CardTitle>Library record</CardTitle>
        <CardDescription>
          A compound card with distinct content regions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>Northbridge Community Library</p>
      </CardContent>
      <CardFooter>
        <Button variant="surface">View details</Button>
      </CardFooter>
    </Card>
  ),
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
