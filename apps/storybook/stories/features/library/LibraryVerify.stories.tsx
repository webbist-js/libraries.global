import { LibraryVerify } from "@/components/library/LibraryVerify"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within } from "storybook/test"

import { readerSession } from "../../../.storybook/FixtureSession"
import {
  verifyLibrary,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"

const meta = {
  title: "Features/Library/LibraryVerify",
  component: LibraryVerify,
  args: { library: verifyLibrary, initial: ["hours", "status"], onDone: fn() },
  parameters: {
    fixtureResponses: libraryResponses,
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryVerify>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SignedIn: Story = {
  parameters: { fixtureSession: readerSession },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(
      canvas.getByRole("textbox", { name: /Where did you check/ }),
      "https://example.invalid/library/hours"
    )
    await userEvent.click(canvas.getByRole("button", { name: "Send" }))
    const thanks = await canvas.findByRole("heading", {
      name: "Thanks. A Moderator will check it.",
    })
    await expect(thanks).toHaveFocus()
  },
}
