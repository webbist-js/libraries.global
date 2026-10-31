"use client"

import { useTranslations } from "next-intl"
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import { DiscussionComposer } from "@/components/discussions/DiscussionComposer"
import { Drawer } from "@/components/ds/Drawer"
import { T } from "@/lib/design-tokens"

type ComposerProps = ComponentProps<typeof DiscussionComposer>

/** Every start-discussion entry point shares the editor, review and modal contracts. */
export function DiscussionComposerDrawer({
  open,
  onClose,
  onOpen,
  subjectControl,
  contextTitle,
  children,
  ...props
}: ComposerProps & {
  readonly open: boolean
  readonly onClose: () => void
  readonly onOpen?: () => void
  readonly subjectControl?: ReactNode
  readonly contextTitle?: string
  readonly children?: ReactNode
}) {
  const t = useTranslations("discussions")
  const id = useId()
  const busy = useRef(false)
  const trackBusy = useCallback((value: boolean) => {
    busy.current = value
  }, [])
  const [draft, setDraft] = useState({
    title: props.initialTitle ?? "",
    body: props.initialBody ?? "",
    language: props.language,
  })
  const [attachments, setAttachments] = useState(props.initialAttachments ?? [])
  const scope = props.target
    ? `${props.target.uid}:${props.target.documentId}:${props.target.locale ?? ""}`
    : "directory"
  const [reopened, setReopened] = useState(false)
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get("composeDiscussion") !== scope) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reopen the matching page context after sign-in.
    setReopened(true)
    onOpen?.()
    url.searchParams.delete("composeDiscussion")
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`
    )
  }, [scope, onOpen])
  const close = () => {
    if (busy.current) {
      toast.info(t("editorBusy"))

      return
    }
    setReopened(false)
    onClose()
  }
  const returnTo = () => {
    const url = new URL(
      props.returnTo ??
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      window.location.origin
    )
    url.searchParams.set("composeDiscussion", scope)

    return `${url.pathname}${url.search}${url.hash}`
  }

  return (
    <Drawer
      open={open || reopened}
      onClose={close}
      side="left"
      size="xl"
      edgeAligned
      initialFocus={(panel) =>
        panel.querySelector<HTMLElement>("textarea:not(:disabled)") ??
        panel.querySelector<HTMLElement>("a[href], button")
      }
      titleId={id}
      title={t("newThread")}
      subtitle={contextTitle ?? props.subject?.name}
      icon={{
        name: "mdi:message-text-outline",
        bg: T.accent.chip,
        fg: T.accent.primary,
      }}
    >
      <div
        className={`flex h-full min-h-0 flex-col ${props.subject && (!props.signedIn || props.disabled) ? "gap-4 p-5 sm:p-6" : ""}`}
      >
        {props.subject && !props.signedIn && (
          <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
            {t("reviewLead")}
          </p>
        )}
        {props.subject ? (
          <DiscussionComposer
            {...props}
            layout="drawer"
            subjectControl={
              subjectControl ?? (
                <div className="text-sm font-semibold">
                  {props.subject.name}
                </div>
              )
            }
            onCancel={close}
            onBusyChange={trackBusy}
            initialTitle={draft.title}
            initialBody={draft.body}
            language={draft.language}
            initialAttachments={attachments}
            returnTo={
              typeof window === "undefined" ? props.returnTo : returnTo()
            }
            onDraftChange={(value) => {
              setDraft(value)
              props.onDraftChange?.(value)
            }}
            onAttachmentsChange={(value) => {
              setAttachments(value)
              props.onAttachmentsChange?.(value)
            }}
            onSubmitted={(record) => {
              busy.current = false
              setDraft({ title: "", body: "", language: undefined })
              setAttachments([])
              toast.success(t("pendingFeedback"))
              props.onSubmitted(record)
              setReopened(false)
              onClose()
            }}
          />
        ) : (
          <div className="p-6">{children}</div>
        )}
      </div>
    </Drawer>
  )
}
