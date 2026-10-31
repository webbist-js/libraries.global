import { RoleApplicationAside } from "@/components/contribute/RoleApplicationAside"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import {
  publicServerFixtures,
  publicResponses,
} from "../../fixtures/public/server"

const meta = {
  title: "Features/Contribute/RoleApplicationAside",
  component: RoleApplicationAside,
  args: { role: "wiki_editor" },
  parameters: {
    serverFixtures: publicServerFixtures,
    fixtureResponses: publicResponses,
  },
} satisfies Meta<typeof RoleApplicationAside>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Journal: Story = { args: { role: "journal_editor" } }
export const Moderator: Story = { args: { role: "moderator" } }
