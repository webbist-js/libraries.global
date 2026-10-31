import {
  LibraryCorrectionProvider,
  OpenCorrectionLink,
  OpenVerifyLink,
} from "@/components/library/LibraryCorrection"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { readerSession } from "../../../.storybook/FixtureSession"
import {
  wizardLibrary,
  verifyLibrary,
  libraryPath,
  libraryResponses,
  libraryServerFixtures,
} from "../../fixtures/geography/library"
import { editorResponses } from "../../fixtures/library-editor"

const meta = {
  title: "Features/Library/LibraryCorrectionProvider",
  component: LibraryCorrectionProvider,
  args: {
    library: wizardLibrary,
    record: verifyLibrary,
    path: libraryPath,
    children: (
      <div className="flex gap-4">
        <OpenCorrectionLink category="Opening hours">
          Suggest a correction
        </OpenCorrectionLink>
        <OpenVerifyLink sections={["hours", "status"]}>
          Confirm these details
        </OpenVerifyLink>
      </div>
    ),
  },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureSession: readerSession,
    fixtureResponses: { ...libraryResponses, ...editorResponses },
    serverFixtures: libraryServerFixtures,
  },
} satisfies Meta<typeof LibraryCorrectionProvider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const OpeningHoursCheck: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button", {
      name: "Confirm these details",
    })
    await userEvent.click(trigger)
    const dialog = await within(canvasElement.ownerDocument.body).findByRole(
      "dialog",
      { name: "Still right?" }
    )
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute("data-drawer-panel", "right")
    await expect(dialog).toHaveAttribute("data-drawer-edge", "true")
    await expect(
      within(dialog).getByRole("checkbox", { name: "Opening hours" })
    ).toBeChecked()
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}
export const OpeningHoursCheckDark: Story = {
  ...OpeningHoursCheck,
  globals: { appearance: "dark" },
}
