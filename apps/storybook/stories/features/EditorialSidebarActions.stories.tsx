import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

const meta = {
  title: "Features/Editorial/Sidebar actions",
  component: DashboardSidebarCta,
  args: {
    title: "New to the Staff area?",
    body: "Read the guide before managing a library.",
    action: {
      label: "Read the staff guide",
      href: "/knowledge/contributing/claiming-your-library",
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 300, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Direct coverage of the actual sidebar CTA. The Journal has separate monthly dispatch stories.",
      },
    },
  },
} satisfies Meta<typeof DashboardSidebarCta>

export default meta
type Story = StoryObj<typeof meta>

export const GuideAction: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: /Read the staff guide/ })
    ).toHaveAttribute("href", "/knowledge/contributing/claiming-your-library")
  },
}
export const SecondaryAction: Story = {
  args: {
    secondary: {
      label: "View your contributions",
      href: "/contribute/submissions",
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("link", { name: "View your contributions" })
    ).toHaveAttribute("href", "/contribute/submissions")
  },
}
