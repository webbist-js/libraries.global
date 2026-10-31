/** Preferences are persisted; the resolved light/dark appearance is not. */
export const APPEARANCE_PREFERENCES = ["light", "dark", "system"] as const
export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number]
export type ResolvedAppearance = "light" | "dark"
export const APPEARANCE_STORAGE_KEY = "lg-appearance-v1"
export const ANONYMOUS_APPEARANCE_KEY = "lg-appearance-anonymous-v1"
export const appearanceAvailable =
  process.env.NEXT_PUBLIC_FORCE_LIGHT_THEME !== "true"

export function isAppearancePreference(
  value: unknown
): value is AppearancePreference {
  return (
    typeof value === "string" &&
    APPEARANCE_PREFERENCES.includes(value as AppearancePreference)
  )
}
export function appearanceDirtyKey(actor: string) {
  return `lg-appearance-pending-v1:${encodeURIComponent(actor)}`
}

export type AppearanceSnapshot = {
  preference: AppearancePreference
  actor: string | null | undefined
  status: "idle" | "loading" | "saving" | "saved" | "error"
  storageAvailable: boolean
}
type Environment = {
  storageKey?: string
  storage: () => Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined
  apply: (preference: AppearancePreference) => void
  load: (
    actor: string,
    signal: AbortSignal
  ) => Promise<AppearancePreference | null>
  save: (
    actor: string,
    preference: AppearancePreference,
    signal: AbortSignal
  ) => Promise<void>
}
const initialSnapshot: AppearanceSnapshot = {
  preference: "system",
  actor: undefined,
  status: "idle",
  storageAvailable: true,
}

/** Small account coordinator around next-themes. No theme DOM/media engine lives here. */
export class AppearanceController {
  private snapshot = initialSnapshot
  private listeners = new Set<() => void>()
  private generation = 0
  private choiceRevision = 0
  private requests = new Set<AbortController>()
  private pending: AppearancePreference | null = null
  private writing = false

  constructor(private readonly environment: Environment) {}
  getSnapshot = () => this.snapshot
  getServerSnapshot = () => initialSnapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)

    return () => this.listeners.delete(listener)
  }

  private update(patch: Partial<AppearanceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  private storage(
    action: "get" | "set" | "remove",
    key: string,
    value?: string
  ) {
    try {
      const storage = this.environment.storage()
      if (!storage) throw new Error("Storage unavailable")
      if (action === "get") return storage.getItem(key)
      if (action === "set") storage.setItem(key, value!)
      else storage.removeItem(key)
    } catch {
      if (this.snapshot.storageAvailable)
        this.update({ storageAvailable: false })
    }

    return null
  }

  private anonymousKey() {
    return this.environment.storageKey &&
      this.environment.storageKey !== APPEARANCE_STORAGE_KEY
      ? `${this.environment.storageKey}:anonymous`
      : ANONYMOUS_APPEARANCE_KEY
  }

  private dirtyKey(actor: string) {
    return this.environment.storageKey &&
      this.environment.storageKey !== APPEARANCE_STORAGE_KEY
      ? `${this.environment.storageKey}:pending:${encodeURIComponent(actor)}`
      : appearanceDirtyKey(actor)
  }

  private anonymousPreference() {
    const value = this.storage("get", this.anonymousKey())

    return isAppearancePreference(value) ? value : "system"
  }

  private apply(preference: AppearancePreference) {
    this.update({ preference })
    this.environment.apply(preference)
  }

  hydrate(preference: unknown) {
    if (isAppearancePreference(preference)) this.update({ preference })
    else this.apply("system")
  }

  /** Storage events update the view without echoing another tab's server write. */
  external(preference: AppearancePreference) {
    if (preference === this.snapshot.preference) return
    this.choiceRevision++
    this.update({ status: "idle" })
    this.apply(preference)
  }

  async setActor(actor: string | null) {
    if (actor === this.snapshot.actor) return
    const previous = this.snapshot.actor
    const initial = previous === undefined
    this.generation++
    for (const request of this.requests) request.abort()
    this.requests.clear()
    if (previous) this.storage("remove", this.dirtyKey(previous))
    this.pending = null
    this.writing = false
    this.update({ actor, status: "idle" })
    if (!initial || !actor) this.apply(this.anonymousPreference())
    if (!actor) return
    const pending = this.storage("get", this.dirtyKey(actor))
    if (isAppearancePreference(pending)) {
      this.pending = pending
      this.apply(pending)
      this.update({ status: "error" })

      return
    }
    // A fresh choice while session identity was still resolving beats a stale read.
    if (initial && this.choiceRevision > 0) {
      this.pending = this.snapshot.preference
      this.storage("set", this.dirtyKey(actor), this.pending)
      await this.flush()

      return
    }
    await this.load()
  }

  private async load() {
    const actor = this.snapshot.actor
    if (!actor) return
    const generation = this.generation
    const revision = this.choiceRevision
    const request = new AbortController()
    this.requests.add(request)
    this.update({ status: "loading" })
    try {
      const preference = await this.environment.load(actor, request.signal)
      if (
        generation !== this.generation ||
        revision !== this.choiceRevision ||
        request.signal.aborted
      )
        return
      if (preference) this.apply(preference)
      else this.apply(this.anonymousPreference())
      this.update({ status: "idle" })
    } catch {
      if (
        generation === this.generation &&
        revision === this.choiceRevision &&
        !request.signal.aborted
      )
        this.update({ status: "error" })
    } finally {
      this.requests.delete(request)
    }
  }

  choose = (preference: AppearancePreference) => {
    this.choiceRevision++
    this.apply(preference)
    const actor = this.snapshot.actor
    if (!actor) {
      this.storage("set", this.anonymousKey(), preference)
      this.update({ status: "idle" })

      return
    }
    this.pending = preference
    this.storage("set", this.dirtyKey(actor), preference)
    this.flush()
  }

  private async flush() {
    if (this.writing || !this.pending || !this.snapshot.actor) return
    const actor = this.snapshot.actor
    const generation = this.generation
    const preference = this.pending
    const request = new AbortController()
    this.pending = null
    this.writing = true
    this.requests.add(request)
    this.update({ status: "saving" })
    try {
      await this.environment.save(actor, preference, request.signal)
      if (generation !== this.generation || request.signal.aborted) return
      if (!this.pending && this.snapshot.preference === preference) {
        this.storage("remove", this.dirtyKey(actor))
        this.update({ status: "saved" })
      }
    } catch {
      if (generation !== this.generation || request.signal.aborted) return
      if (!this.pending) this.pending = preference
      this.update({ status: "error" })

      return
    } finally {
      this.requests.delete(request)
      if (generation === this.generation) this.writing = false
    }
    if (generation === this.generation && this.pending) this.flush()
  }

  retry = () => (this.pending ? this.flush() : this.load())
  dispose() {
    this.generation++
    for (const request of this.requests) request.abort()
    this.requests.clear()
    this.writing = false
    this.update({ actor: undefined, status: "idle" })
  }
}
