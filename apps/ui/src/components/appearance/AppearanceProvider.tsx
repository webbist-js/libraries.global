"use client"

import { ThemeProvider, useTheme } from "next-themes"
import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import {
  AppearanceController,
  APPEARANCE_STORAGE_KEY,
  appearanceAvailable,
  isAppearancePreference,
  type AppearancePreference,
  type ResolvedAppearance,
} from "@/lib/appearance"

async function readPreference(actor: string, signal: AbortSignal) {
  const response = await fetch("/api/profile/me/appearance", {
    cache: "no-store",
    headers: { "X-Appearance-Actor": actor },
    signal,
  })
  if (!response.ok) throw new Error("Appearance unavailable")
  const body = await response.json()
  if (
    body.actorId !== actor ||
    (body.preference !== null && !isAppearancePreference(body.preference))
  )
    throw new Error("Account changed")

  return body.preference as AppearancePreference | null
}
async function savePreference(
  actor: string,
  preference: AppearancePreference,
  signal: AbortSignal
) {
  const response = await fetch("/api/profile/me/appearance", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actorId: actor, preference }),
    signal,
  })
  if (!response.ok) throw new Error("Appearance not saved")
  const body = await response.json()
  if (body.actorId !== actor || body.preference !== preference)
    throw new Error("Account changed")
}
type Context = ReturnType<AppearanceController["getSnapshot"]> & {
  ready: boolean
  enabled: boolean
  resolved: ResolvedAppearance
  choose: (value: AppearancePreference) => void
  retry: () => void
  controller: AppearanceController
}
const AppearanceContext = createContext<Context | null>(null)

export const useAppearance = () => useContext(AppearanceContext)

export function AppearanceProvider({
  children,
  nonce,
  storageKey = APPEARANCE_STORAGE_KEY,
  preference,
  onPreferenceChange,
  enabled = appearanceAvailable,
  controller,
}: {
  readonly children: ReactNode
  readonly nonce?: string
  readonly storageKey?: string
  /** Controlled preview only; the app coordinates account preferences internally. */
  readonly preference?: AppearancePreference
  readonly onPreferenceChange?: (value: AppearancePreference) => void
  readonly enabled?: boolean
  /** Tests/previews may supply a deterministic account transport without real services. */
  readonly controller?: AppearanceController
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      storageKey={storageKey}
      nonce={nonce}
      forcedTheme={
        enabled ? (preference === "system" ? undefined : preference) : "light"
      }
    >
      <AppearanceBridge
        enabled={enabled}
        storageKey={storageKey}
        preference={preference}
        onPreferenceChange={onPreferenceChange}
        suppliedController={controller}
      >
        {children}
      </AppearanceBridge>
    </ThemeProvider>
  )
}
function AppearanceBridge({
  children,
  storageKey,
  preference,
  onPreferenceChange,
  enabled,
  suppliedController,
}: {
  children: ReactNode
  storageKey: string
  preference?: AppearancePreference
  onPreferenceChange?: (value: AppearancePreference) => void
  enabled: boolean
  suppliedController?: AppearanceController
}) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const apply = useRef(setTheme)
  apply.current = setTheme
  // eslint-disable-next-line react/hook-use-state -- Lazily create one controller for this bridge; its identity is never replaced.
  const [controller] = useState(
    () =>
      suppliedController ??
      new AppearanceController({
        storageKey,
        storage: () =>
          typeof window === "undefined" ? undefined : window.localStorage,
        apply: (value) => apply.current(value),
        load: readPreference,
        save: savePreference,
      })
  )
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot
  )
  const [ready, setReady] = useState(false)
  useEffect(() => {
    controller.hydrate(theme)
    setReady(true)

    return () => controller.dispose()
    // The initial next-themes value bootstraps once; later storage changes use external().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller])
  useEffect(() => {
    if (ready && preference) controller.external(preference)
  }, [controller, preference, ready])
  useEffect(() => {
    if (ready && !preference && isAppearancePreference(theme))
      controller.external(theme)
  }, [controller, theme, preference, ready])
  useEffect(() => {
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue("--t-bg-void")
      .trim()
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )
    if (!meta) {
      meta = document.createElement("meta")
      meta.name = "theme-color"
      document.head.append(meta)
    }
    meta.content = color
  }, [resolvedTheme])
  const value = useMemo<Context>(
    () => ({
      ...state,
      ready,
      enabled,
      resolved: enabled && resolvedTheme === "dark" ? "dark" : "light",
      controller,
      choose: (preference) => {
        if (!enabled || !ready) return
        controller.choose(preference)
        onPreferenceChange?.(preference)
      },
      retry: controller.retry,
    }),
    [state, ready, enabled, resolvedTheme, controller, onPreferenceChange]
  )

  return <AppearanceContext value={value}>{children}</AppearanceContext>
}
