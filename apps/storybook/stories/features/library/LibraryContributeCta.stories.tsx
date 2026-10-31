import { LibraryContributeCta } from "@/components/library/LibraryContributeCta"
import { LibraryCorrectionProvider } from "@/components/library/LibraryCorrection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, within } from "storybook/test"

import { readerSession } from "../../../.storybook/FixtureSession"
import {
  editorBootstrap,
  editorResponses,
  editorSlug,
} from "../../fixtures/library-editor"

const meta = {
  title: "Features/Library/LibraryContributeCta",
  component: LibraryContributeCta,
  args: { documentId: "example-library", slug: editorSlug },
  parameters: {
    fixtureSession: readerSession,
    fixtureResponses: editorResponses,
  },
  decorators: [
    (Story) => (
      <LibraryCorrectionProvider
        library={{ slug: editorSlug, name: editorBootstrap.target.name }}
        path="/library"
      >
        <div className="max-w-sm">
          <Story />
        </div>
      </LibraryCorrectionProvider>
    ),
  ],
} satisfies Meta<typeof LibraryContributeCta>

export default meta
type Story = StoryObj<typeof meta>

export const Contributor: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "Improve this library" })
    )
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Improve this library" }
    )
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute("data-drawer-panel", "left")
    await expect(dialog).toHaveAttribute("data-drawer-edge", "true")
  },
}
export const Compact: Story = { args: { compact: true } }
export const Staff: Story = {
  parameters: {
    fixtureSession: {
      ...readerSession,
      user: {
        ...readerSession.user,
        staffLibraries: [{ id: "example-library" }],
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByRole("link", { name: "Manage record" })
    ).toBeVisible()
  },
}
export const SignedOut: Story = {
  parameters: { fixtureSession: null },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("button", {
        name: "Improve this library",
      })
    ).not.toBeInTheDocument()
  },
}
