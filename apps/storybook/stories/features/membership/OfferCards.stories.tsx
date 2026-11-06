import { OfferCards } from "@/app/[locale]/(dashboard)/contribute/_components/membership/OfferCards"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Membership/OfferCards",
  component: OfferCards,
  args: {
    viewer: {
      signedIn: false,
      standing: "public",
      isStaff: false,
      hasApi: false,
    },
  },
  parameters: { docs: { story: { inline: false, height: "1400px" } } },
} satisfies Meta<typeof OfferCards>

export default meta
type Story = StoryObj<typeof meta>

export const SignedOut: Story = {}
export const Contributor: Story = {
  args: {
    viewer: {
      signedIn: true,
      standing: "contributor",
      isStaff: true,
      hasApi: false,
    },
  },
}
export const ApiCustomer: Story = {
  args: {
    viewer: {
      signedIn: true,
      standing: "explorer",
      isStaff: false,
      hasApi: true,
    },
  },
}
