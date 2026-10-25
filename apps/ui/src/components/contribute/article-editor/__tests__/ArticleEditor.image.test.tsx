// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

import { tiptapToDynamicZone } from "../articleBlocks"
import { ArticleEditor } from "../ArticleEditor"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:article-image")
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function selectImage(
  options: {
    opening?: boolean
    upload?: (file: File) => Promise<{ id: number; url: string } | null>
    file?: File
  } = {}
) {
  const onDocChange = vi.fn()
  const upload =
    options.upload ??
    vi.fn(async () => ({ id: 77, url: "/uploads/image.webp" }))
  render(
    <ArticleEditor
      kind="journal"
      title="Story"
      summary=""
      doc={{
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "A story." }] },
        ],
      }}
      docKey="one"
      onTitleChange={() => {}}
      onSummaryChange={() => {}}
      onDocChange={onDocChange}
      uploadImage={upload}
    />
  )
  await screen.findByRole("toolbar")
  if (options.opening)
    fireEvent.click(
      screen.getByRole("button", { name: /Add an opening image/ })
    )
  const file =
    options.file ??
    new File(["image"], "camera-file.webp", { type: "image/webp" })
  fireEvent.change(screen.getByLabelText("Choose an image to insert"), {
    target: { files: [file] },
  })
  const dialog = await screen.findByRole("dialog")
  if (!options.file) {
    const image = within(dialog).getByRole("img")
    Object.defineProperties(image, {
      naturalWidth: { value: 1600 },
      naturalHeight: { value: 900 },
    })
    fireEvent.load(image)
  }

  return { dialog, upload, onDocChange, file }
}

it("keeps the media ID, alt text and caption through real editor insertion and submission conversion", async () => {
  const { dialog, upload, onDocChange } = await selectImage()
  expect(upload).not.toHaveBeenCalled()
  const insert = within(dialog).getByRole("button", { name: "Insert image" })
  expect((insert as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(within(dialog).getByLabelText("Alt text"), {
    target: { value: "Readers sharing books" },
  })
  fireEvent.change(within(dialog).getByLabelText("File name"), {
    target: { value: "reading-room" },
  })
  fireEvent.change(within(dialog).getByLabelText("Caption and credit"), {
    target: { value: "Photo by Ada" },
  })
  fireEvent.click(insert)
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  const prepared = vi.mocked(upload).mock.calls[0]![0]
  expect(prepared.name).toBe("reading-room.webp")
  expect(prepared.size).toBe(5)
  const doc = onDocChange.mock.calls.at(-1)![0]
  expect(tiptapToDynamicZone(doc)).toContainEqual({
    __component: "content.image-block",
    image: 77,
    alternativeText: "Readers sharing books",
    caption: "Photo by Ada",
    fullWidth: false,
  })
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:article-image")
})

it("inserts an opening image first and requires its credit before uploading", async () => {
  const { dialog, upload, onDocChange } = await selectImage({ opening: true })
  fireEvent.change(within(dialog).getByLabelText("Alt text"), {
    target: { value: "The reading room" },
  })
  const insert = within(dialog).getByRole("button", { name: "Insert image" })
  expect((insert as HTMLButtonElement).disabled).toBe(true)
  expect(upload).not.toHaveBeenCalled()
  fireEvent.change(within(dialog).getByLabelText("Caption and credit"), {
    target: { value: "Photo by the library, CC BY 4.0" },
  })
  fireEvent.click(insert)
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  const doc = onDocChange.mock.calls.at(-1)![0]
  expect(doc.content[0]).toMatchObject({
    type: "image",
    attrs: {
      imageId: 77,
      alt: "The reading room",
      caption: "Photo by the library, CC BY 4.0",
    },
  })
})

it("retains image details after failure and lets the writer retry", async () => {
  const upload = vi
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ id: 77, url: "/uploads/image.webp" })
  const { dialog } = await selectImage({ upload })
  fireEvent.change(within(dialog).getByLabelText("Alt text"), {
    target: { value: "The library" },
  })
  fireEvent.click(within(dialog).getByRole("button", { name: "Insert image" }))
  await screen.findByRole("alert")
  expect(
    (within(dialog).getByLabelText("Alt text") as HTMLTextAreaElement).value
  ).toBe("The library")
  fireEvent.click(within(dialog).getByRole("button", { name: "Insert image" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(upload).toHaveBeenCalledTimes(2)
})

it("rejects unsupported files before upload", async () => {
  const { dialog, upload } = await selectImage({
    file: new File(["svg"], "image.svg", { type: "image/svg+xml" }),
  })
  expect(screen.getByRole("alert").textContent).toContain("JPEG, PNG or WebP")
  expect(
    (
      within(dialog).getByRole("button", {
        name: "Insert image",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
  expect(upload).not.toHaveBeenCalled()
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})

it("cancels without uploading and releases the local preview", async () => {
  const { dialog, upload } = await selectImage()
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(upload).not.toHaveBeenCalled()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:article-image")
})
