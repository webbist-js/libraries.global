import { ModerationQueue } from "@/components/moderation/ModerationQueue"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { moderationRow } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/ModerationQueue",
  component: ModerationQueue,
  args: {
    state: {
      segment: "pending",
      queue: "",
      locale: "",
      q: "",
      drive: "",
      page: 1,
    },
    queues: ["index", "journal"],
    locales: [{ code: "en", name: "English" }],
    localeNames: { en: "English" },
  },
  parameters: {
    fixtureResponses: {
      "GET /api/moderation/submissions": {
        body: {
          data: [moderationRow],
          meta: { page: 1, pageSize: 25, total: 1 },
        },
      },
      "GET /api/moderation/stats": { body: { data: [] } },
    },
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof ModerationQueue>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
