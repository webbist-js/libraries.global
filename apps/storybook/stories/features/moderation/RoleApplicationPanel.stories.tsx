import { RoleApplicationPanel } from "@/components/moderation/RoleApplicationPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { applicant } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/RoleApplicationPanel",
  component: RoleApplicationPanel,
  args: {
    fields: {
      role: "wiki_editor",
      queue: "knowledge",
      locales: ["en"],
      statement: "I would like to improve guidance for library visitors.",
      samples: ["https://example.invalid/article"],
    },
    applicant,
    localeNames: { en: "English" },
  },
} satisfies Meta<typeof RoleApplicationPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
