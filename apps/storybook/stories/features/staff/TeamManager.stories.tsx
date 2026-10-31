import { TeamManager } from "@/app/[locale]/(dashboard)/staff/[slug]/_components/TeamManager"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/TeamManager",
  component: TeamManager,
  args: {
    id: "example-library",
    libraryName: "Northbridge Library",
    data: {
      members: [],
      invites: [],
      audit: [],
      canLeave: false,
      covered: false,
      team: null,
    },
    role: "owner",
    full: false,
    mobile: false,
  },
} satisfies Meta<typeof TeamManager>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
