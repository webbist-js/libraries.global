"use client"

import dynamic from "next/dynamic"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react"
import { toast } from "sonner"

import { actionMeta } from "@/components/contribute/actions"
import type { WizardLibrary } from "@/components/contribute/wizard.logic"
import { Drawer } from "@/components/ds/Drawer"
import { LibraryVerify } from "@/components/library/LibraryVerify"
import {
  toSections,
  type VerifyRecord,
  type VerifySection,
} from "@/components/library/verify.logic"
import type { WizardDraftState } from "@/components/library-editor/wizard.types"
import { pushAnalyticsEvent } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"

const LibraryContributionEditor = dynamic(
  () =>
    import("@/components/library/LibraryContributionEditor").then(
      (module) => module.LibraryContributionEditor
    ),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="p-6">
        Loading the editor…
      </p>
    ),
  }
)

/** Added to the library URL so sign-in brings the user back into the drawer. */
const REOPEN_PARAM = "suggest"
/** With `suggest=verify`: the sections to tick again, comma separated. */
const SECTIONS_PARAM = "sections"

type CorrectionContext = {
  open: (category?: string) => void
  /** Opens the drawer on "Still right?" with these sections ticked. */
  verify: (sections: readonly VerifySection[]) => void
}

/** A correction (with a category picked or not), or a "Still right?". */
type DrawerState =
  | { category: string | null; step?: string; locale?: string }
  | { verify: VerifySection[] }
  | null

const Ctx = createContext<CorrectionContext | null>(null)

/** Opens the correction drawer; a no-op outside LibraryCorrectionProvider. */
export function useCorrectionDrawer(): CorrectionContext {
  return useContext(Ctx) ?? { open: () => {}, verify: () => {} }
}

const VERIFY_META = {
  icon: "mdi:check-decagram-outline",
  tintBg: "var(--tint-public-bg)",
  tintFg: "var(--tint-public-fg)",
  title: "Still right?",
}

function CorrectionDrawer({
  open,
  onAfterClose,
  library,
  record,
  path,
  state,
  onClose,
}: {
  readonly library: WizardLibrary
  readonly record: VerifyRecord
  readonly path: string
  readonly open: boolean
  readonly onAfterClose: () => void
  readonly state: NonNullable<DrawerState>
  readonly onClose: () => void
}) {
  const verify = "verify" in state ? state.verify : null
  const meta = verify
    ? VERIFY_META
    : { ...actionMeta("correction"), title: "Improve this library" }
  const editorState = useRef<WizardDraftState | null>(null)
  const trackState = useCallback((value: WizardDraftState) => {
    editorState.current = value
  }, [])
  const requestClose = () => {
    if (editorState.current?.saving) {
      toast.info("Your draft is still saving. Please wait before closing.")

      return
    }
    if (
      editorState.current?.dirty &&
      !window.confirm(
        "Some changes have not saved yet. Close and keep them in this browser session?"
      )
    )
      return
    onClose()
  }
  const category = "category" in state ? state.category : null
  const step =
    ("step" in state ? state.step : undefined) ??
    (
      {
        "Opening hours": "hours",
        "Stops & times": "stops",
        "Address or location": "location",
        Collections: "collections",
        Photo: "photo",
        Accessibility: "access",
        Services: "visit",
        "Contact details": "links",
        History: "history",
      } as Record<string, string>
    )[category ?? ""]

  return (
    <Drawer
      open={open}
      onAfterClose={onAfterClose}
      icon={{ name: meta.icon, bg: meta.tintBg, fg: meta.tintFg }}
      onClose={requestClose}
      size={verify ? "md" : "xl"}
      side={verify ? "right" : "left"}
      edgeAligned
      subtitle={`${library.name}${library.place ? ` · ${library.place}` : ""}`}
      title={meta.title}
      titleId="correction-drawer-title"
    >
      {verify ? (
        <div className="flex h-full min-h-0 flex-col">
          <LibraryVerify
            initial={verify}
            library={{ ...record, ...library }}
            onDone={onClose}
            returnTo={`${path}?${REOPEN_PARAM}=verify&${SECTIONS_PARAM}=${verify.join(",")}`}
          />
        </div>
      ) : (
        <LibraryContributionEditor
          slug={library.slug}
          path={path}
          step={step}
          locale={"locale" in state ? state.locale : undefined}
          onState={trackState}
          onClose={requestClose}
        />
      )}
    </Drawer>
  )
}

/**
 * Owns the library page's "Suggest a correction" drawer, so any trigger on
 * the page (hero pill, sidebar, facilities link) can open it, and its
 * "Still right?" panel. Opens by itself when the URL carries
 * ?suggest=correction or ?suggest=verify (the sign-in return).
 */
export function LibraryCorrectionProvider({
  library,
  record = {},
  path,
  children,
}: {
  readonly library: WizardLibrary
  /** The record's current values, which "Still right?" asks about. */
  readonly record?: VerifyRecord
  /** This library's page path, without the locale. */
  readonly path: string
  readonly children: ReactNode
}) {
  const [state, setState] = useState<DrawerState>(null)
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reopen = params.get(REOPEN_PARAM)
    if (reopen !== "correction" && reopen !== "verify") return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resume the drawer after the static page mounts
    setOpened(true)

    setState(
      reopen === "verify"
        ? {
            verify: toSections((params.get(SECTIONS_PARAM) ?? "").split(",")),
          }
        : {
            category: null,
            step: params.get("step") ?? undefined,
            locale: params.get("editLocale") ?? undefined,
          }
    )
    params.delete(REOPEN_PARAM)
    params.delete(SECTIONS_PARAM)
    if (reopen === "correction") {
      params.delete("step")
      params.delete("editLocale")
    }
    const qs = params.toString()
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`
    )
  }, [])

  const open = useCallback((category?: string) => {
    pushAnalyticsEvent("correction_open", {
      interaction_source: "library_correction",
      action_type: "open",
    })
    setOpened(true)
    setState({ category: category ?? null })
  }, [])
  const verify = useCallback((sections: readonly VerifySection[]) => {
    pushAnalyticsEvent("correction_open", {
      interaction_source: "library_correction",
      action_type: "open",
    })
    setOpened(true)
    setState({ verify: toSections(sections) })
  }, [])
  const close = useCallback(() => setOpened(false), [])
  const value = useMemo(() => ({ open, verify }), [open, verify])

  return (
    <Ctx.Provider value={value}>
      {children}
      {state ? (
        <CorrectionDrawer
          open={opened}
          onAfterClose={() => setState(null)}
          library={library}
          onClose={close}
          path={path}
          record={record}
          state={state}
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

/** "Still right?": opens the drawer's confirm panel on these sections. */
export function OpenVerifyLink({
  sections,
  children,
  className,
}: {
  readonly sections: readonly VerifySection[]
  readonly children: ReactNode
  readonly className?: string
}) {
  const { verify } = useCorrectionDrawer()

  return (
    <button
      className={className}
      onClick={() => verify(sections)}
      style={{ color: T.accent.primary }}
      type="button"
    >
      {children}
    </button>
  )
}
