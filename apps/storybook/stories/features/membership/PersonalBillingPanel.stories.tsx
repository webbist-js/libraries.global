import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { PersonalBillingPanel } from "@/components/membership/PersonalBillingPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { readerSession } from "../../../.storybook/FixtureSession"
import {
  billingController,
  membershipResponses,
} from "../../fixtures/workspace/membership"

const meta = {
  title: "Features/Membership/PersonalBillingPanel",
  component: PersonalBillingPanel,
  args: { billing: billingController },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: membershipResponses,
    docs: { story: { inline: false, height: "1000px" } },
  },
  decorators: [
    (Story) => (
      <ContactModalProvider>
        <Story />
      </ContactModalProvider>
    ),
  ],
} satisfies Meta<typeof PersonalBillingPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = {
  args: { billing: { ...billingController, summary: null } },
}
export const Unavailable: Story = {
  args: { billing: { ...billingController, error: true } },
}
