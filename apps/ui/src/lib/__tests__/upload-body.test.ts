import { describe, expect, it, vi } from "vitest"

import { readUploadFile } from "../upload-body"

function input(form: FormData) {
  return new Request("http://localhost/upload", { method: "POST", body: form })
}
describe("bounded strict upload multipart", () => {
  it.each([undefined, "1"])(
    "counts actual stream bytes despite Content-Length=%s and stops reading",
    async (declared) => {
      let chunks = 0
      const cancelled = vi.fn()
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          chunks++
          controller.enqueue(new Uint8Array(40_000))
        },
        cancel: cancelled,
      })
      const req = new Request("http://localhost/upload", {
        method: "POST",
        body: stream,
        duplex: "half",
        headers: {
          "content-type": "multipart/form-data; boundary=test",
          ...(declared ? { "content-length": declared } : {}),
        },
      } as RequestInit)
      const result = await readUploadFile(req, "file", 1024)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(413)
      expect(cancelled).toHaveBeenCalled()
      expect(chunks).toBeLessThan(5)
    }
  )
  it("accepts exactly one File under the expected field", async () => {
    const form = new FormData()
    form.append("file", new File(["image"], "image.png"))
    const result = await readUploadFile(input(form), "file", 1024)
    expect(result.ok).toBe(true)
    if (result.ok) expect(await result.file.text()).toBe("image")
  })
  it.each(["text", "extra", "wrong-field"])(
    "rejects malformed multipart shape: %s",
    async (kind) => {
      const form = new FormData()
      if (kind === "text") form.append("file", "not a File")
      else {
        form.append(
          kind === "wrong-field" ? "files" : "file",
          new File(["image"], "image.png")
        )
        if (kind === "extra") form.append("metadata", "unexpected")
      }
      const result = await readUploadFile(input(form), "file", 1024)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(400)
    }
  )
  it("bounds a stalled body and cancels its reader", async () => {
    const cancelled = vi.fn()
    const stream = new ReadableStream<Uint8Array>({
      pull() {},
      cancel: cancelled,
    })
    const req = new Request("http://localhost/upload", {
      method: "POST",
      body: stream,
      duplex: "half",
      headers: { "content-type": "multipart/form-data; boundary=test" },
    } as RequestInit)
    const result = await readUploadFile(req, "file", 1024, 5)
    if (result.ok) throw new Error("A stalled body must fail")
    expect(result.response.status).toBe(408)
    expect(cancelled).toHaveBeenCalled()
  })
})
