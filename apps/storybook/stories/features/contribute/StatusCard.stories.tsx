import { StatusCard } from "@/components/contribute/article-editor/ArticleSidebar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/StatusCard",
  component: StatusCard,
  args: {
    mode: "edit",
    kind: "knowledge",
    translating: false,
    localeName: "English",
    saveState: "saved",
    lastSavedAt: new Date("2026-01-20T12:00:00Z"),
    submitState: "idle",
    submitError: null,
    canSubmit: true,
    publishesDirectly: false,
    onSubmit: fn(),
    checks: [
      { id: "title", label: "Title and summary", done: true },
      { id: "body", label: "Article body", done: true },
      { id: "sources", label: "Reliable sources", done: false },
    ],
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof StatusCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Offline: Story = { args: { offline: true, saveState: "error" } }
export const Saving: Story = { args: { saveState: "saving" } }
export const DirectPublishing: Story = { args: { publishesDirectly: true } }
