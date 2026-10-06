"use client"

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { actionMeta } from "@/components/contribute/actions"
import { ContributionWizard } from "@/components/contribute/ContributionWizard"
import type { WizardLibrary } from "@/components/contribute/wizard.logic"
import { Drawer } from "@/components/ds/Drawer"
import { LibraryVerify } from "@/components/library/LibraryVerify"
import {
  toSections,
  type VerifyRecord,
  type VerifySection,
} from "@/components/library/verify.logic"
import { T } from "@/lib/design-tokens"

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
  | { category: string | null }
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
  library,
  record,
  path,
  state,
  onClose,
}: {
  readonly library: WizardLibrary
  readonly record: VerifyRecord
  readonly path: string
  readonly state: NonNullable<DrawerState>
  readonly onClose: () => void
}) {
  const verify = "verify" in state ? state.verify : null
  const meta = verify ? VERIFY_META : actionMeta("correction")

  return (
    <Drawer
      icon={{ name: meta.icon, bg: meta.tintBg, fg: meta.tintFg }}
      onClose={onClose}
      subtitle={`${library.name}${library.place ? ` · ${library.place}` : ""}`}
      title={meta.title}
      titleId="correction-drawer-title"
    >
      {verify ? (
        <LibraryVerify
          initial={verify}
          library={{ ...record, ...library }}
          onDone={onClose}
          returnTo={`${path}?${REOPEN_PARAM}=verify&${SECTIONS_PARAM}=${verify.join(",")}`}
        />
      ) : (
        <ContributionWizard
          action="correction"
          headingId="correction-drawer-title"
          initialCategory={"category" in state ? state.category : null}
          initialLibrary={library}
          layout="drawer"
          lockLibrary
          returnTo={`${path}?${REOPEN_PARAM}=correction`}
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reopen = params.get(REOPEN_PARAM)
    if (reopen !== "correction" && reopen !== "verify") return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the page is static, so the URL is read after mount
    setState(
      reopen === "verify"
        ? {
            verify: toSections((params.get(SECTIONS_PARAM) ?? "").split(",")),
          }
        : { category: null }
    )
    params.delete(REOPEN_PARAM)
    params.delete(SECTIONS_PARAM)
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
  const verify = useCallback(
    (sections: readonly VerifySection[]) =>
      setState({ verify: toSections(sections) }),
    []
  )
  const close = useCallback(() => setState(null), [])
  const value = useMemo(() => ({ open, verify }), [open, verify])

  return (
    <Ctx.Provider value={value}>
      {children}
      {state ? (
        <CorrectionDrawer
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
