import { ApplicantSummary } from "@/components/moderation/ApplicantSummary"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Moderation/Applicant evidence",
  component: ApplicantSummary,
  args: {
    missingLabel: "Applicant details aren’t available.",
    applicant: {
      username: "example-member",
      acceptedCount: 2,
      recentAccepted: [
        {
          type: "library_correction",
          summary: "Corrected an opening time with a public source",
          decidedAt: "2026-01-10T12:00:00Z",
        },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="grid max-w-xl gap-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ApplicantSummary>

export default meta
type Story = StoryObj<typeof meta>

export const RecentChanges: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: "@example-member" })
    ).toHaveAttribute("href", "/profile/example-member")
    await expect(
      canvas.getByRole("list", { name: "Recent accepted changes" })
    ).toBeVisible()
  },
}
export const NoChanges: Story = {
  args: { applicant: { username: null, acceptedCount: 0, recentAccepted: [] } },
}
export const MissingProposer: Story = {
  args: { applicant: null, missingLabel: "Proposer details aren’t available." },
}
export const French: Story = { globals: { locale: "fr" } }
