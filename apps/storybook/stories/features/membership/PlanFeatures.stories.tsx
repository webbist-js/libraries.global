import { PlanFeatures } from "@/app/[locale]/(dashboard)/contribute/_components/membership/PlanBits"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/PlanFeatures",
  component: PlanFeatures,
  args: {
    items: [
      { text: "Everything in Explorer", status: "live" },
      {
        text: "2 new one-library Reach calculations every 7 days",
        status: "live",
      },
      { text: "Alerts on saved searches", status: "soon" },
      {
        text: "Recognition never grants editing rights or staff verification.",
        status: "note",
      },
    ],
  },
} satisfies Meta<typeof PlanFeatures>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
