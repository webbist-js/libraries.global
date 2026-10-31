import { StaffDrawer } from "@/components/staff/StaffDrawer"
import { StaffDrawerMount } from "@/components/staff/StaffDrawerMount"
import { Button } from "@/components/ui/button"
import {
  openStaffDrawer,
  useStaffDrawer,
  closeStaffDrawer,
} from "@/lib/staff/drawer"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { userEvent } from "storybook/test"

import {
  readerSession,
  profileResponses,
} from "../../fixtures/workspace/profile"
import { staffLibrary } from "../../fixtures/workspace/staff"

const fixtureSession = {
  ...readerSession,
  user: {
    ...readerSession.user,
    capabilities: [
      "staff.area",
      "moderate.queue",
      "docs.directEdit",
      "journal.directEdit",
      "drives.manage",
    ],
    staffLibraries: [staffLibrary],
    claimedLibraryIds: [staffLibrary.id],
    moderationScopes: [{ queue: "all", locale: null }],
  },
}
const meta = {
  title: "Features/Staff/StaffDrawer",
  parameters: {
    fixtureSession,
    fixtureResponses: {
      ...profileResponses,
      "GET /api/drives/featured": { body: { data: null } },
      "GET /api/moderation/summary": {
        body: {
          data: [
            { id: "libraries", pending: 3 },
            { id: "articles", pending: 1 },
            { id: "claims", pending: 0 },
            { id: "drives", pending: 2 },
            { id: "applications", pending: 0 },
            { id: "discussions", pending: 1 },
          ],
        },
      },
      "GET /api/staff/example-library/drawer": {
        body: {
          library: {
            documentId: "example-library",
            name: "Northbridge Library",
            slug: "northbridge",
            path: "/libraries/northbridge",
            libraryType: "Public",
            role: "owner",
          },
          suggestions: 3,
          noticesUpcoming: 1,
          live: null,
          drives: [],
        },
      },
    },
    docs: { story: { inline: false, height: "740px" } },
  },
  beforeEach: () => {
    closeStaffDrawer()

    return () => closeStaffDrawer()
  },
  render: function Example() {
    const state = useStaffDrawer()

    return (
      <>
        <Button variant="surface" onClick={() => openStaffDrawer()}>
          Open staff workspace
        </Button>
        <StaffDrawer open={state.open} />
      </>
    )
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const MountedEntryPoint: Story = { render: () => <StaffDrawerMount /> }
export const Opened: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Open staff workspace" })
    )
  },
}
