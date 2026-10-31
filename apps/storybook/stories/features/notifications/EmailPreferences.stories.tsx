import { EmailPreferences } from "@/app/[locale]/email/preferences/preferences"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Notifications/EmailPreferences",
  component: EmailPreferences,
  args: { token: "synthetic-email-link" },
  parameters: {
    fixtureResponses: {
      "GET /api/email/preferences": {
        body: { action: "unsubscribe", purpose: "the monthly dispatch" },
      },
      "POST /api/email/preferences": { body: { ok: true } },
    },
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof EmailPreferences>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
