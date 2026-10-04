"use client"

import type { DismissiblePrompt as PromptKey } from "@repo/shared-data"
import { X } from "lucide-react"
import {
  type CSSProperties,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  hidePromptForSession,
  savePromptSetting,
} from "@/lib/dismissed-prompts"

const DismissContext = createContext<(() => void) | null>(null)

/**
 * A prompt the reader can hide with a `PromptDismissButton` inside it:
 * until the browser closes, and for a signed-in user also in their
 * settings, until they turn it back on. The server leaves a hidden prompt
 * out of later pages (`isPromptHidden`); this covers the page it was hidden
 * on, swapping it for a one-line status that takes focus.
 */
export function DismissiblePrompt({
  prompt,
  signedIn,
  className,
  children,
}: {
  readonly prompt: PromptKey
  readonly signedIn: boolean
  /** Wraps the status line left in the prompt's place. */
  readonly className?: string
  readonly children: ReactNode
}) {
  const [hidden, setHidden] = useState<"session" | "settings" | null>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const wasHidden = hidden !== null

  useEffect(() => {
    if (wasHidden) statusRef.current?.focus()
  }, [wasHidden])

  const dismiss = useCallback(() => {
    hidePromptForSession(prompt)
    if (!signedIn) {
      setHidden("session")

      return
    }
    setHidden("settings")
    const save = async () => {
      if (!(await savePromptSetting(prompt, true))) setHidden("session")
    }
    void save()
  }, [prompt, signedIn])

  if (!hidden)
    return (
      <DismissContext.Provider value={dismiss}>
        {children}
      </DismissContext.Provider>
    )

  return (
    <div className={className}>
      <p
        ref={statusRef}
        role="status"
        tabIndex={-1}
        className="m-0 text-[14.5px]"
        style={{ color: T.ink.dim }}
      >
        {hidden === "settings" ? (
          <>
            Hidden. You can turn it back on in{" "}
            <GlobalLink
              href="/profile/settings#notifications"
              className="font-semibold underline underline-offset-2"
              style={{ color: T.accent.primary }}
            >
              Settings
            </GlobalLink>
            .
          </>
        ) : (
          "Hidden until you close your browser."
        )}
      </p>
    </div>
  )
}

/** Hides the enclosing `DismissiblePrompt`; renders nothing outside one. */
export function PromptDismissButton({
  label,
  className,
  style,
}: {
  readonly label: string
  readonly className?: string
  readonly style?: CSSProperties
}) {
  const dismiss = useContext(DismissContext)
  if (!dismiss) return null

  return (
    <button
      type="button"
      onClick={dismiss}
      aria-label={label}
      title={label}
      className={className}
      style={style}
    >
      <X aria-hidden="true" className="size-4" strokeWidth={2} />
    </button>
  )
}
