"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { captureContactContext } from "@/lib/contact/context"
import {
  CONTACT_TYPES,
  type ContactContext,
  type ContactIntent,
  type ContactType,
  mailtoContactIntent,
} from "@/lib/contact/model"

const ContactModal = dynamic(
  () => import("@/components/contact/ContactModal"),
  { ssr: false }
)
type ModalRequest = {
  intent: ContactIntent
  context: ContactContext
  trigger: HTMLElement | null
  id: number
}
const ContactModalContext = createContext<{
  openFeedback: () => void
  openAtlasFeedback: () => void
  openContact: (type?: ContactType) => void
} | null>(null)

export function ContactModalProvider({
  children,
  aliases = [],
}: {
  readonly children: ReactNode
  readonly aliases?: readonly string[]
}) {
  const [request, setRequest] = useState<ModalRequest | null>(null)
  const [opened, setOpened] = useState(false)
  const requestId = useRef(0)
  const pathname = usePathname()
  const pageStarted = useRef(Date.now())
  useEffect(() => {
    pageStarted.current = Date.now()
  }, [pathname])
  const open = useCallback(
    (
      intent: ContactIntent,
      trigger = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    ) => {
      setOpened(true)
      setRequest({
        intent,
        context: captureContactContext(
          (Date.now() - pageStarted.current) / 1000
        ),
        trigger,
        id: ++requestId.current,
      })
    },
    []
  )
  const openFeedback = useCallback(() => open({ mode: "feedback" }), [open])
  const openAtlasFeedback = useCallback(
    () => open({ mode: "feedback", product: "atlas" }),
    [open]
  )
  const openContact = useCallback(
    (type: ContactType = "general_inquiry") => open({ mode: "contact", type }),
    [open]
  )
  const value = useMemo(
    () => ({ openFeedback, openAtlasFeedback, openContact }),
    [openFeedback, openAtlasFeedback, openContact]
  )

  useEffect(() => {
    // One delegated listener also covers links supplied by CMS content and future pages.
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null
      if (!link) return
      const intent = mailtoContactIntent(
        link.getAttribute("href") ?? "",
        aliases
      )
      if (!intent) return
      const type = link.dataset.contactType
      if (
        intent.mode === "contact" &&
        CONTACT_TYPES.includes(type as ContactType)
      )
        intent.type = type as ContactType
      event.preventDefault()
      open(intent, link)
    }
    document.addEventListener("click", onClick)

    return () => document.removeEventListener("click", onClick)
  }, [aliases, open])

  return (
    <ContactModalContext.Provider value={value}>
      {children}
      {request ? (
        <ContactModal
          key={request.id}
          intent={request.intent}
          context={request.context}
          trigger={request.trigger}
          open={opened}
          onClose={() => setOpened(false)}
          onAfterClose={() =>
            setRequest((current) =>
              current?.id === request.id ? null : current
            )
          }
        />
      ) : null}
    </ContactModalContext.Provider>
  )
}

export function useContactModal() {
  const context = useContext(ContactModalContext)
  if (!context) throw new Error("ContactModalProvider is missing")

  return context
}
