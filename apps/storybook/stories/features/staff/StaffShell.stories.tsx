import { StaffShell } from "@/app/[locale]/(dashboard)/staff/[slug]/_components/StaffShell"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { staffLibrary } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/StaffShell",
  component: StaffShell,
  args: {
    overview: {
      library: {
        documentId: "example-library",
        name: "Northbridge Library",
        slug: "northbridge",
        libraryType: "Public",
        path: "/libraries/northbridge",
      },
      role: "owner",
      health: [],
      counts: { suggestions: 3, noticesUpcoming: 1 },
    },
    libraries: [staffLibrary],
    meta: { operatorName: "Example Library Service", homeLibrary: null },
    plan: "free",
    teamCovered: false,
  },
} satisfies Meta<typeof StaffShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
