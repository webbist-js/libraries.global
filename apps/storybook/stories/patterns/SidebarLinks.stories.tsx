import { SidebarLinks } from "@/components/ds/SidebarLinks"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Patterns/SidebarLinks",
  component: SidebarLinks,
  args: {
    children: (
      <>
        <li>
          <a href="https://example.invalid/guide">Contribution guide</a>
        </li>
        <li>
          <a href="https://example.invalid/contact">Contact the team</a>
        </li>
      </>
    ),
  },
} satisfies Meta<typeof SidebarLinks>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const FlushEnd: Story = { args: { flushEnd: true } }
