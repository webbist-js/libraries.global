import { ApiWorkspacePage } from "@/components/developers/ApiWorkspacePage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { asyncStory } from "../../../.storybook/AsyncStory"
import { readerSession } from "../../fixtures/workspace/profile"
import {
  guestApiAccess,
  signedInApiAccess,
  memberApiAccess,
  activeApiAccess,
  unavailableApiAccess,
  conflictApiAccess,
  apiOrganiserSession,
  apiMemberSession,
  apiConflictSession,
  apiWorkspaceResponses,
} from "../../fixtures/workspace/team-api"

const meta = {
  title: "Features/Developers/ApiWorkspacePage",
  component: ApiWorkspacePage,
  render: asyncStory(ApiWorkspacePage),
  args: { section: "overview" },
  parameters: {
    react: { rsc: true },
    fixtureSession: null,
    serverFixtures: { "teamApi.apiWorkspaceAccess": guestApiAccess },
    fixtureResponses: apiWorkspaceResponses,
    nextjs: { navigation: { pathname: "/developers" } },
    docs: { story: { inline: false, height: "1100px" } },
  },
} satisfies Meta<typeof ApiWorkspacePage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedInWithoutTeam: Story = {
  parameters: {
    fixtureSession: readerSession,
    serverFixtures: { "teamApi.apiWorkspaceAccess": signedInApiAccess },
  },
}
export const MemberWithoutApi: Story = {
  parameters: {
    fixtureSession: apiMemberSession,
    serverFixtures: { "teamApi.apiWorkspaceAccess": memberApiAccess },
  },
}
export const ActiveTeam: Story = {
  parameters: {
    fixtureSession: apiOrganiserSession,
    serverFixtures: { "teamApi.apiWorkspaceAccess": activeApiAccess },
  },
}
export const Keys: Story = {
  args: { section: "keys" },
  parameters: {
    fixtureSession: apiOrganiserSession,
    serverFixtures: { "teamApi.apiWorkspaceAccess": activeApiAccess },
  },
}
export const Usage: Story = {
  args: { section: "usage" },
  parameters: {
    fixtureSession: apiOrganiserSession,
    serverFixtures: { "teamApi.apiWorkspaceAccess": activeApiAccess },
  },
}
export const RequestReference: Story = { args: { section: "reference" } }
export const Playground: Story = {
  args: { section: "playground" },
  parameters: {
    fixtureSession: apiOrganiserSession,
    serverFixtures: { "teamApi.apiWorkspaceAccess": activeApiAccess },
  },
}
export const Unavailable: Story = {
  parameters: {
    fixtureSession: apiOrganiserSession,
    serverFixtures: { "teamApi.apiWorkspaceAccess": unavailableApiAccess },
  },
}
export const MembershipConflict: Story = {
  parameters: {
    fixtureSession: apiConflictSession,
    serverFixtures: { "teamApi.apiWorkspaceAccess": conflictApiAccess },
  },
}
