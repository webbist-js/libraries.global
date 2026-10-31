import { DriveProposalPanel } from "@/components/moderation/DriveProposalPanel"
import type { DriveInput } from "@repo/shared-data"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { drive } from "../../fixtures/public/drives"
import { applicant } from "../../fixtures/workspace/moderation"

const proposalDrive: DriveInput = {
  title: drive.title,
  summary: drive.summary,
  scope: drive.scope,
  focus: drive.focus,
  unit: drive.unit,
  startsAt: drive.startsAt,
  endsAt: drive.endsAt,
  goalPercent: drive.goalPercent,
  steps: drive.steps.map((step) => step.text),
  whereToLook: {
    name: drive.whereToLook?.name ?? "",
    url: drive.whereToLook?.url ?? "",
    licenceNote: drive.whereToLook?.licenceNote ?? "",
  },
}
const meta = {
  title: "Features/Moderation/DriveProposalPanel",
  component: DriveProposalPanel,
  args: {
    documentId: "example-proposal",
    status: "pending",
    proposal: {
      drive: proposalDrive,
      datesEdited: false,
      counts: { total: 50, todo: 18 },
      errors: [],
      created: null,
    },
    applicant,
  },
} satisfies Meta<typeof DriveProposalPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
