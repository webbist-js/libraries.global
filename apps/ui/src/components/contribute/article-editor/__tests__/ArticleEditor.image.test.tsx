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
  expect(editor.updateAttributes).toHaveBeenCalledWith("image", { imageId: 77 })
  expect(upload).toHaveBeenCalledWith(file)
})
