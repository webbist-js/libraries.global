import { SponsorPage } from "@/components/sponsor/SponsorPage"
import {
  SponsorAcknowledgementList,
  SponsorEnquiry,
  SponsorProgrammes,
  SponsorRecognition,
} from "@/components/sponsor/SponsorSections"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import {
  noSponsorAcknowledgements,
  sponsorAcknowledgements,
  unavailableSponsorAcknowledgements,
} from "../../fixtures/public/sponsors"

const meta = {
  title: "Features/Sponsor/SponsorPage",
  component: SponsorPage,
  args: { acknowledgements: sponsorAcknowledgements },
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 900 },
      description: {
        component:
          "The public /sponsor page: programmes, suggested annual amounts from membership-pricing.json, recognition, independence, the consented sponsor list and the enquiry link that opens the contact form with Sponsorship chosen. Open Canvas to use the interactive Controls.",
      },
    },
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
    react: { rsc: true },
  },
} satisfies Meta<typeof SponsorPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const NoSponsorsYet: Story = {
  args: { acknowledgements: noSponsorAcknowledgements },
}
export const ListUnavailable: Story = {
  args: { acknowledgements: unavailableSponsorAcknowledgements },
}

/** Each section on its own, outside the information shell. */
export const Sections: Story = {
  render: (args) => (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-14 p-6">
      <SponsorProgrammes />
      <SponsorRecognition />
      <SponsorAcknowledgementList acknowledgements={args.acknowledgements} />
      <SponsorEnquiry />
    </div>
  ),
}
