import { PlanSectionHeader } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanBits"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/PlanSectionHeader",
  component: PlanSectionHeader,
  args: {
    id: "example-plans",
    title: "Choose your membership",
    sub: "Support the library index and choose the tools you need.",
  },
} satisfies Meta<typeof PlanSectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
