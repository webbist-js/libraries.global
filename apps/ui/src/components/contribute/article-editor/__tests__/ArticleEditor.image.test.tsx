// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { ArticleEditor } from "../ArticleEditor"

const editor = vi.hoisted(() => ({
  setEditable: vi.fn(),
  commands: { setContent: vi.fn() },
  isActive: () => false,
  getAttributes: () => ({}),
  can: () => ({ undo: () => false, redo: () => false }),
  chain: vi.fn(),
  setImage: vi.fn(),
  updateAttributes: vi.fn(),
  run: vi.fn(),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("../extensions", () => ({ articleExtensions: () => [] }))
vi.mock("@tiptap/react", () => ({
  useEditor: () => editor,
  EditorContent: () => null,
  useEditorState: ({ selector }: any) => selector({ editor }),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it("requires a deliberate image description before upload/insertion and preserves per-block alt and owned media ID", async () => {
  const chain = {
    focus: () => chain,
    setImage: (attrs: unknown) => {
      editor.setImage(attrs)

      return chain
    },
    updateAttributes: (name: unknown, attrs: unknown) => {
      editor.updateAttributes(name, attrs)

      return chain
    },
    run: editor.run,
  }
  editor.chain.mockReturnValue(chain)
  const upload = vi.fn().mockResolvedValue({
    id: 77,
    url: "/uploads/image.webp",
    alt: "CMS default",
  })
  render(
    <ArticleEditor
      kind="journal"
      title="Story"
      summary=""
      doc={{ type: "doc", content: [] }}
      docKey="one"
      onTitleChange={() => {}}
      onSummaryChange={() => {}}
      onDocChange={() => {}}
      uploadImage={upload}
    />
  )
  const file = new File(["image"], "camera-file.webp", { type: "image/webp" })
  fireEvent.change(screen.getByLabelText("Choose an image to insert"), {
    target: { files: [file] },
  })
  expect(upload).not.toHaveBeenCalled()
  expect(editor.setImage).not.toHaveBeenCalled()
  const insert = screen.getAllByRole("button", { name: "Insert image" })[1]!
  expect((insert as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText("Alt text"), {
    target: { value: "Readers sharing books at a library workshop" },
  })
  fireEvent.click(insert)
  await waitFor(() =>
    expect(editor.setImage).toHaveBeenCalledWith({
      src: "/uploads/image.webp",
      alt: "Readers sharing books at a library workshop",
    })
  )
  expect(editor.updateAttributes).toHaveBeenCalledWith(
    "image",
    expect.objectContaining({
      imageId: 77,
      alt: "Readers sharing books at a library workshop",
      caption: null,
    })
  )
  expect(upload).toHaveBeenCalledWith(file)
})

it("inserts an opening image first and requires its alt text and credit before uploading", async () => {
  const insertContentAt = vi.fn()
  const chain = {
    focus: () => chain,
    insertContentAt: (position: unknown, node: unknown) => {
      insertContentAt(position, node)

      return chain
    },
    run: editor.run,
  }
  editor.chain.mockReturnValue(chain)
  const upload = vi
    .fn()
    .mockResolvedValue({ id: 88, url: "/uploads/opening.webp" })
  render(
    <ArticleEditor
      kind="journal"
      title="Story"
      summary=""
      doc={{ type: "doc", content: [] }}
      docKey="opening"
      onTitleChange={() => {}}
      onSummaryChange={() => {}}
      onDocChange={() => {}}
      uploadImage={upload}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: /Add an opening image/ }))
  const file = new File(["photo"], "opening.webp", { type: "image/webp" })
  fireEvent.change(screen.getByLabelText("Choose an image to insert"), {
    target: { files: [file] },
  })
  fireEvent.change(screen.getByLabelText("Alt text"), {
    target: { value: "The reading room" },
  })
  const insert = screen.getAllByRole("button", { name: "Insert image" })[1]!
  expect((insert as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText("Caption and credit"), {
    target: { value: "Photo by the library, CC BY 4.0" },
  })
  fireEvent.click(insert)
  await waitFor(() =>
    expect(insertContentAt).toHaveBeenCalledWith(0, {
      type: "image",
      attrs: {
        src: "/uploads/opening.webp",
        imageId: 88,
        alt: "The reading room",
        caption: "Photo by the library, CC BY 4.0",
      },
    })
  )
  expect(upload).toHaveBeenCalledWith(file)
})
