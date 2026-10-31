import { RoleApplicationForm } from "@/components/contribute/RoleApplicationForm"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { heldRoles } from "../../fixtures/public/editor"
import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"
import { contributorSession } from "../../fixtures/public/session"

const meta = {
  title: "Features/Contribute/RoleApplicationForm",
  component: RoleApplicationForm,
  args: {
    acceptedCount: 12,
    locales: [
      { code: "en", label: "English" },
      { code: "fr", label: "French" },
    ],
    initialLocales: ["en"],
    initialRole: "wiki_editor",
    applications: [],
    accepted: [],
    acceptedTotal: 12,
    username: "maya",
    wikiSections: [{ slug: "getting-started", name: "Getting started" }],
    blogSections: [{ slug: "library-stories", name: "Library stories" }],
    held: heldRoles,
    guidelines: {
      editor: "/knowledge/editor-guidelines",
      moderator: "/knowledge/moderation",
    },
  },
  parameters: {
    fixtureSession: contributorSession,
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof RoleApplicationForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const BuildingExperience: Story = {
  args: { acceptedCount: 2, acceptedTotal: 2 },
}
export const ModeratorApplication: Story = {
  args: { initialRole: "moderator" },
}
