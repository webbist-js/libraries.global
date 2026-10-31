import { FreePlansCard } from "@/app/[locale]/(dashboard)/contribute/_components/membership/FreePlansCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/FreePlansCard",
  component: FreePlansCard,
  args: { signedIn: false },
} satisfies Meta<typeof FreePlansCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Member: Story = { args: { signedIn: true } }
