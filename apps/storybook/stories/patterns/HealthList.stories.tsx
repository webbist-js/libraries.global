import { HealthList } from "@/components/ds/HealthList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useId } from "react"

const meta = {
  title: "Patterns/HealthList",
  component: HealthList,
  render: function Example(args) {
    const id = useId()

    return (
      <HealthList
        {...args}
        headingId={`${args.headingId ?? "example"}-${id}`}
      />
    )
  },
  args: {
    title: "Record health",
    rows: [
      {
        key: "hours",
        label: "Opening hours",
        note: "Checked this month",
        status: "ok",
      },
      {
        key: "photo",
        label: "Library photo",
        note: "Add a recent photograph",
        status: "todo",
        action: { href: "/contribute", label: "Add photo" },
      },
    ],
    score: { done: 1, total: 2 },
  },
} satisfies Meta<typeof HealthList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
