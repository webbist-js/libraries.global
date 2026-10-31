import { DashboardShell } from "@/components/dashboard/DashboardShell"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { profileResponses } from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Dashboard/DashboardShell",
  component: DashboardShell,
  args: {
    locale: "en",
    children: <p className="p-6">The library workspace.</p>,
  },
  parameters: {
    react: { rsc: true },
    fixtureResponses: profileResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof DashboardShell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
