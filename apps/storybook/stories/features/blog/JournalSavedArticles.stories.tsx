import { DEFAULT_JOURNAL_QUERY } from "@/components/blog/journalLanding.helpers"
import { JournalSavedArticles } from "@/components/blog/JournalSaved"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Blog/JournalSavedArticles",
  component: JournalSavedArticles,
  args: { query: DEFAULT_JOURNAL_QUERY },
  beforeEach: () => {
    const key = "libraries-global:journal-saved:v1"
    const previous = localStorage.getItem(key)
    localStorage.setItem(key, JSON.stringify(["example-article"]))
    window.dispatchEvent(new Event("journal-saved-changed"))

    return () => {
      if (previous === null) localStorage.removeItem(key)
      else localStorage.setItem(key, previous)
      window.dispatchEvent(new Event("journal-saved-changed"))
    }
  },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof JournalSavedArticles>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  beforeEach: () => {
    const key = "libraries-global:journal-saved:v1"
    localStorage.removeItem(key)
    window.dispatchEvent(new Event("journal-saved-changed"))
  },
  parameters: {
    docs: {
      description: {
        component:
          "This example runs in its own iframe to keep fixture requests, caches and page landmarks independent. Open Canvas to use the interactive Controls.",
      },
      story: { inline: false, iframeHeight: 400 },
    },
  },
}
