import { LibraryFollowButton } from "@/components/library/LibraryFollowButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { readerSession } from "../../../.storybook/FixtureSession"
import {
  completeLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryFollowButton",
  component: LibraryFollowButton,
  args: {
    libraryDocumentId: completeLibrary.documentId,
    libraryName: completeLibrary.name,
  },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryFollowButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SignedIn: Story = {
  parameters: { fixtureSession: readerSession },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const follow = await canvas.findByRole("button", { name: "Follow" })
    await userEvent.click(follow)
    await expect(
      await canvas.findByRole("button", { name: "Following" })
    ).toHaveAttribute("aria-pressed", "true")
  },
}
