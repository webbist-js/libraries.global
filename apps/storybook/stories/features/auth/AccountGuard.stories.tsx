import { AccountGuard } from "@/components/auth/AccountGuard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { readerSession } from "../../fixtures/workspace/profile"

const meta = {
  title: "Features/Auth/AccountGuard",
  component: AccountGuard,
  args: {
    expectedScope: readerSession.user.id,
    mode: "identity",
    children: (
      <p className="rounded-2xl border p-5">
        Your private account workspace is available.
      </p>
    ),
  },
  parameters: {
    fixtureSession: readerSession,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof AccountGuard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const ChangedAccount: Story = {
  args: { expectedScope: "another-example-account" },
}
