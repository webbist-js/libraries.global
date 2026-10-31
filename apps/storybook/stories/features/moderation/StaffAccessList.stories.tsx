import { StaffAccessList } from "@/components/moderation/StaffAccessList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/StaffAccessList",
  component: StaffAccessList,
  args: {
    libraryName: "Northbridge Library",
    rows: [
      {
        affiliationDocumentId: "example-affiliation",
        name: "Maya S.",
        staffRole: "owner",
        source: "claim",
        approvedAt: "2026-01-15",
        canRemove: true,
      },
    ],
  },
} satisfies Meta<typeof StaffAccessList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { rows: [] } }
