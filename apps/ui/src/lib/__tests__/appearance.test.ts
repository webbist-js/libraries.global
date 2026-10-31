import { describe, expect, it, vi } from "vitest"

import {
  AppearanceController,
  ANONYMOUS_APPEARANCE_KEY,
  appearanceDirtyKey,
  isAppearancePreference,
} from "@/lib/appearance"

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })

  return { promise, resolve, reject }
}
function setup() {
  const values = new Map<string, string>()
  const apply = vi.fn()
  const load = vi.fn(
    async (
      _actor: string,
      _signal: AbortSignal
    ): Promise<"light" | "dark" | "system" | null> => null
  )
  const save = vi.fn(
    async (_actor: string, _preference: string, _signal: AbortSignal) => {}
  )
  const controller = new AppearanceController({
    storage: () => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value)
      },
      removeItem: (key) => {
        values.delete(key)
      },
    }),
    apply,
    load,
    save,
  })

  return { controller, values, apply, load, save }
}
describe("appearance preference coordination", () => {
  it("validates preferences without accepting the resolved appearance as a different preference", () => {
    expect(["light", "dark", "system"].every(isAppearancePreference)).toBe(true)
    expect([null, "auto", "Dark", {}, true].some(isAppearancePreference)).toBe(
      false
    )
  })
  it("stores anonymous choices separately and restores them after sign-out", async () => {
    const { controller: c, values, load } = setup()
    await c.setActor(null)
    c.choose("light")
    load.mockResolvedValue("dark")
    await c.setActor("alice")
    expect(c.getSnapshot().preference).toBe("dark")
    await c.setActor(null)
    expect(c.getSnapshot().preference).toBe("light")
    expect(values.get(ANONYMOUS_APPEARANCE_KEY)).toBe("light")
  })
  it("a late profile read cannot overwrite a newer choice", async () => {
    const { controller: c, load } = setup()
    const read = deferred<"dark">()
    load.mockReturnValue(read.promise)
    const started = c.setActor("alice")
    c.choose("light")
    read.resolve("dark")
    await started
    expect(c.getSnapshot().preference).toBe("light")
  })
  it("serializes writes and coalesces rapid choices to the last intent", async () => {
    const { controller: c, save, values } = setup()
    await c.setActor("alice")
    const first = deferred<void>()
    save.mockReturnValueOnce(first.promise)
    c.choose("dark")
    c.choose("light")
    c.choose("system")
    expect(save).toHaveBeenCalledTimes(1)
    first.resolve()
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1]?.slice(0, 2)).toEqual(["alice", "system"])
    expect(c.getSnapshot().preference).toBe("system")
    expect(values.has(appearanceDirtyKey("alice"))).toBe(false)
  })
  it("keeps failed writes local and allows an explicit retry", async () => {
    const { controller: c, save, values } = setup()
    await c.setActor("alice")
    save.mockRejectedValueOnce(new Error("offline"))
    c.choose("dark")
    await vi.waitFor(() => expect(c.getSnapshot().status).toBe("error"))
    expect(values.get(appearanceDirtyKey("alice"))).toBe("dark")
    c.retry()
    await vi.waitFor(() => expect(c.getSnapshot().status).toBe("saved"))
    expect(values.has(appearanceDirtyKey("alice"))).toBe(false)
  })
  it("never replays another account's queued write or stale read", async () => {
    const { controller: c, save, load } = setup()
    await c.setActor("alice")
    const first = deferred<void>()
    save.mockReturnValueOnce(first.promise)
    c.choose("dark")
    c.choose("system")
    load.mockResolvedValue("light")
    await c.setActor("bob")
    first.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0]?.[2].aborted).toBe(true)
    expect(c.getSnapshot()).toMatchObject({ actor: "bob", preference: "light" })
  })
  it("recovers pending intent after reload without an automatic server mutation", async () => {
    const { controller: c, values, save } = setup()
    values.set(appearanceDirtyKey("alice"), "system")
    await c.setActor("alice")
    expect(c.getSnapshot()).toMatchObject({
      preference: "system",
      status: "error",
    })
    expect(save).not.toHaveBeenCalled()
    c.retry()
    await vi.waitFor(() => expect(c.getSnapshot().status).toBe("saved"))
  })
  it("cross-tab updates do not echo an account write", async () => {
    const { controller: c, save } = setup()
    await c.setActor("alice")
    c.external("system")
    expect(save).not.toHaveBeenCalled()
    expect(c.getSnapshot().preference).toBe("system")
  })
  it("continues in memory when storage is blocked", () => {
    const c = new AppearanceController({
      storage: () => {
        throw new Error("denied")
      },
      apply: vi.fn(),
      load: vi.fn(),
      save: vi.fn(),
    })
    c.choose("dark")
    expect(c.getSnapshot()).toMatchObject({
      preference: "dark",
      storageAvailable: false,
    })
  })
  it("can reconnect after a strict-mode effect cleanup", async () => {
    const { controller: c, load } = setup()
    await c.setActor("alice")
    c.dispose()
    await c.setActor("alice")
    expect(load).toHaveBeenCalledTimes(2)
  })
})
