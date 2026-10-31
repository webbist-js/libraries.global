import { MembershipBillingSection } from "@/app/[locale]/profile/settings/_components/MembershipBillingSection"
import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { membershipResponses } from "../../fixtures/workspace/membership"
import { readerSession } from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Settings/MembershipBillingSection",
  component: MembershipBillingSection,
  decorators: [
    (Story) => (
      <ContactModalProvider>
        <Story />
      </ContactModalProvider>
    ),
  ],
  args: {},
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: membershipResponses,
    docs: { story: { inline: false, height: "900px" } },
  },
} satisfies Meta<typeof MembershipBillingSection>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
