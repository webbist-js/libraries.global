import { Drawer } from "@/components/ds/Drawer"
import { LibraryContributionEditor } from "@/components/library/LibraryContributionEditor"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, userEvent, within, waitFor } from "storybook/test"

import { readerSession } from "../../../.storybook/FixtureSession"
import {
  editorBootstrap,
  editorResponses,
  editorSlug,
  editorStatusResponses,
} from "../../fixtures/library-editor"

const meta = {
  title: "Features/Library/LibraryContributionEditor",
  component: LibraryContributionEditor,
  args: {
    slug: editorSlug,
    path: `/europe/example-country/northbridge/${editorSlug}`,
    onState: fn(),
    onClose: fn(),
  },
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureSession: readerSession,
    fixtureResponses: editorResponses,
  },
  decorators: [
    (Story) => (
      <Drawer
        titleId="contribution-title"
        title="Improve this library"
        subtitle={editorBootstrap.target.name}
        size="xl"
        side="left"
        edgeAligned
        onClose={fn()}
      >
        <Story />
      </Drawer>
    ),
  ],
} satisfies Meta<typeof LibraryContributionEditor>

export default meta
type Story = StoryObj<typeof meta>
const body = (element: HTMLElement) => within(element.ownerDocument.body)

export const Prefilled: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      await body(canvasElement).findByLabelText(/Library name/)
    ).toHaveValue(editorBootstrap.initialData.name)
  },
}
export const Dark: Story = { ...Prefilled, globals: { appearance: "dark" } }
export const SubmitForReview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = body(canvasElement)
    const name = await canvas.findByLabelText(/Library name/)
    await userEvent.clear(name)
    await userEvent.type(name, "Northbridge Library and Reading Room")
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Editor section" })
    )
    await userEvent.click(
      await canvas.findByRole("option", { name: "Sources & send" })
    )
    await userEvent.type(
      await canvas.findByRole("textbox", { name: /Submission summary/ }),
      "Correct the library name"
    )
    const send = canvas.getByRole("button", { name: "Submit for review" })
    await waitFor(() => expect(send).toBeEnabled())
    await userEvent.click(send)
    await expect(await canvas.findByText("Submitted for review")).toBeVisible()
    await expect(
      canvas.getByRole("button", { name: "Back to library" })
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "Submit for review" })
    ).not.toBeInTheDocument()
  },
}
export const ResumeDraft: Story = {
  parameters: { fixtureResponses: editorStatusResponses("draft") },
  play: async ({ canvasElement }) => {
    const canvas = body(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", {
        name: /Draft Correct the library name/,
      })
    )
    await userEvent.click(
      await canvas.findByRole("button", { name: "Continue" })
    )
    await expect(
      await canvas.findByRole("textbox", { name: /Submission summary/ })
    ).toHaveValue("Correct the library name")
  },
}
export const ChangesRequested: Story = {
  parameters: { fixtureResponses: editorStatusResponses("needs_info") },
  play: async ({ canvasElement }) => {
    const canvas = body(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", {
        name: /Needs changes Correct the library name/,
      })
    )
    await expect(
      await canvas.findByText(
        "Please link to the library’s current name on its official website."
      )
    ).toBeVisible()
    await userEvent.click(
      await canvas.findByRole("button", { name: "Continue" })
    )
    const send = canvas.getByRole("button", { name: "Submit for review" })
    await waitFor(() => expect(send).toBeEnabled())
    await userEvent.click(send)
    await expect(await canvas.findByText("Submitted for review")).toBeVisible()
  },
}
export const Pending: Story = {
  parameters: { fixtureResponses: editorStatusResponses("pending") },
  play: async ({ canvasElement }) => {
    const canvas = body(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", {
        name: /Submitted for review Correct the library name/,
      })
    )
    await expect(
      await canvas.findByRole("button", { name: "Refresh status" })
    ).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "Continue your changes" })
    ).not.toBeInTheDocument()
  },
}
export const Accepted: Story = {
  parameters: { fixtureResponses: editorStatusResponses("approved") },
  play: async ({ canvasElement }) => {
    const canvas = body(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", {
        name: /Accepted Correct the library name/,
      })
    )
    await expect(
      await canvas.findByText("Accepted", { exact: true })
    ).toBeVisible()
  },
}
export const NotAccepted: Story = {
  parameters: { fixtureResponses: editorStatusResponses("rejected") },
  play: async ({ canvasElement }) => {
    const canvas = body(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", {
        name: /Not accepted Correct the library name/,
      })
    )
    await expect(
      await canvas.findByText("Not accepted", { exact: true })
    ).toBeVisible()
  },
}
export const SignedOut: Story = {
  parameters: { fixtureSession: null },
  play: async ({ canvasElement }) => {
    await expect(
      await body(canvasElement).findByRole("link", {
        name: "Sign in to contribute",
      })
    ).toBeVisible()
  },
}
export const LoadFailure: Story = {
  parameters: {
    fixtureResponses: {
      ...editorResponses,
      [`GET /api/contribute/library/${editorSlug}/editor`]: {
        status: 503,
        body: { error: "Unavailable" },
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      await body(canvasElement).findByRole("button", { name: "Retry" })
    ).toBeVisible()
  },
}
export const Staff: Story = {
  parameters: {
    fixtureResponses: {
      ...editorResponses,
      [`GET /api/contribute/library/${editorSlug}/editor`]: {
        body: {
          data: {
            ...editorBootstrap,
            staffHref: `/staff/libraries/${editorSlug}/edit`,
          },
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      await body(canvasElement).findByRole("link", { name: "Manage record" })
    ).toBeVisible()
  },
}

export const SaveFailure: Story = {
  parameters: {
    fixtureResponses: {
      ...editorResponses,
      "POST /api/submissions": { status: 503, body: { error: "Unavailable" } },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = body(canvasElement),
      name = await canvas.findByLabelText(/Library name/)
    await userEvent.clear(name)
    await userEvent.type(name, "Unsaved proposal")
    await expect(
      await canvas.findByRole(
        "button",
        { name: "Retry saving" },
        { timeout: 4000 }
      )
    ).toBeVisible()
    await expect(name).toHaveValue("Unsaved proposal")
  },
}
export const SessionExpired: Story = {
  parameters: {
    fixtureResponses: {
      ...editorResponses,
      [`GET /api/contribute/library/${editorSlug}/editor`]: {
        status: 401,
        body: { error: "Expired" },
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(
      await body(canvasElement).findByRole("link", { name: "Sign in again" })
    ).toBeVisible()
  },
}
export const PublishedRecordChanged: Story = {
  parameters: {
    fixtureResponses: {
      ...editorResponses,
      [`GET /api/contribute/library/${editorSlug}`]: {
        body: {
          data: { ...editorBootstrap.initialData, name: "New published name" },
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = body(canvasElement),
      name = await canvas.findByLabelText(/Library name/)
    await userEvent.clear(name)
    await userEvent.type(name, "My proposed name")
    await userEvent.click(
      canvas.getByRole("combobox", { name: "Editor section" })
    )
    await userEvent.click(
      await canvas.findByRole("option", { name: "Sources & send" })
    )
    await userEvent.type(
      await canvas.findByRole("textbox", { name: /Submission summary/ }),
      "Correct the library name"
    )
    const send = canvas.getByRole("button", { name: "Submit for review" })
    await waitFor(() => expect(send).toBeEnabled())
    await userEvent.click(send)
    const compare = await canvas.findByRole("button", {
      name: "Compare with the latest record",
    })
    await expect(
      canvas.queryByText("Submitted for review", { exact: true })
    ).not.toBeInTheDocument()
    await userEvent.click(compare)
    await expect(
      await canvas.findByText("New published name", { exact: true })
    ).toBeVisible()
    await expect(
      canvas.getByText("My proposed name", { exact: true })
    ).toBeVisible()
  },
}
