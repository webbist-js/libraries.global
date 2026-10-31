import { AccountAwareLink } from "@/components/profile/AccountAwareLink"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { readerSession } from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Profile/AccountAwareLink",
  component: AccountAwareLink,
  args: { href: "/profile/example-reader", children: "Your profile" },
  parameters: {
    fixtureSession: readerSession,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof AccountAwareLink>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
