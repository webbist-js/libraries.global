"use client"

import { Icon } from "@iconify/react"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { ContributionWizard } from "@/components/contribute/ContributionWizard"
import type { WizardLibrary } from "@/components/contribute/wizard.logic"
import { T } from "@/lib/design-tokens"

/** Added to the library URL so sign-in brings the user back into the drawer. */
const REOPEN_PARAM = "suggest"

type CorrectionContext = { open: (category?: string) => void }

const Ctx = createContext<CorrectionContext | null>(null)

/** Opens the correction drawer; a no-op outside LibraryCorrectionProvider. */
export function useCorrectionDrawer(): CorrectionContext {
  return useContext(Ctx) ?? { open: () => {} }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

function CorrectionDrawer({
  library,
  path,
  category,
  onClose,
}: {
  readonly library: WizardLibrary
  readonly path: string
  readonly category: string | null
  readonly onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = "hidden"
    // Start on the first field; the Close button comes before it.
    const start =
      panel.current?.querySelector<HTMLElement>("select, textarea, input") ??
      panel.current?.querySelector<HTMLElement>("button")
    start?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()

        return
      }
      if (e.key !== "Tab" || !panel.current) return
      // Keep Tab inside the dialog.
      const items = [
        ...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter((el) => el.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]!
      const last = items.at(-1)!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)

    return () => {
      document.removeEventListener("keydown", onKey)
      root.style.overflow = overflow
      returnFocus?.focus?.()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        aria-label="Close"
        className="absolute inset-0 cursor-default border-0"
        onClick={onClose}
        style={{ background: "rgba(23,22,43,.32)" }}
        tabIndex={-1}
        type="button"
      />
      <div
        ref={panel}
        aria-labelledby="correction-drawer-title"
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto border-l sm:w-[min(580px,100vw)]"
        role="dialog"
        style={{ background: T.bg.void, borderColor: T.border.hi }}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-6 py-3 sm:px-8"
          style={{ background: T.bg.void, borderColor: T.border.line }}
        >
          <p
            className="m-0 text-[14px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            {library.name}
          </p>
          <button
            aria-label="Close"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-white"
            onClick={onClose}
            style={{ borderColor: T.border.line, color: T.ink.base }}
            type="button"
          >
            <Icon aria-hidden="true" height={20} icon="mdi:close" width={20} />
          </button>
        </div>
        <div className="px-6 py-7 sm:px-8">
          <ContributionWizard
            action="correction"
            headingId="correction-drawer-title"
            initialCategory={category}
            initialLibrary={library}
            lockLibrary
            returnTo={`${path}?${REOPEN_PARAM}=correction`}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Owns the library page's "Suggest a correction" drawer, so any trigger on
 * the page (hero pill, sidebar, facilities link) can open it. Opens by
 * itself when the URL carries ?suggest=correction (the sign-in return).
 */
export function LibraryCorrectionProvider({
  library,
  path,
  children,
}: {
  readonly library: WizardLibrary
  /** This library's page path, without the locale. */
  readonly path: string
  readonly children: ReactNode
}) {
  const [state, setState] = useState<{ category: string | null } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get(REOPEN_PARAM) !== "correction") return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the page is static, so the URL is read after mount
    setState({ category: null })
    params.delete(REOPEN_PARAM)
    const qs = params.toString()
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`
    )
  }, [])

  const open = useCallback(
    (category?: string) => setState({ category: category ?? null }),
    []
  )
  const close = useCallback(() => setState(null), [])
  const value = useMemo(() => ({ open }), [open])

  return (
    <Ctx.Provider value={value}>
      {children}
      {state ? (
        <CorrectionDrawer
          category={state.category}
          library={library}
          onClose={close}
          path={path}
        />
      ) : null}
    </Ctx.Provider>
  )
}

/** A link-styled trigger for server-rendered sections. */
export function OpenCorrectionLink({
  category,
  children,
  className,
}: {
  readonly category?: string
  readonly children: ReactNode
  readonly className?: string
}) {
  const { open } = useCorrectionDrawer()

  return (
    <button
      className={className}
      onClick={() => open(category)}
      style={{ color: T.accent.primary }}
      type="button"
    >
      {children}
    </button>
  )
}
