import { ApiOfferOverview } from "@/components/developers/ApiOfferOverview"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Developers/ApiOfferOverview",
  component: ApiOfferOverview,
  args: {
    buy: { href: "#api-checkout", label: "buy" },
    limits: {
      perMinute: 30,
      concurrency: 2,
      responseBytes: 131_072,
      pageSize: 50,
    },
  },
} satisfies Meta<typeof ApiOfferOverview>

export default meta
type Story = StoryObj<typeof meta>

export const Prospect: Story = {}
export const SignedOut: Story = {
  args: {
    buy: { href: "/auth/signin?callbackUrl=/developers", label: "signIn" },
  },
}
