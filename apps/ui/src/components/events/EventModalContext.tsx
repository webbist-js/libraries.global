"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

interface EventModalContextValue {
  openModal: (documentId: string) => void
  closeModal: () => void
  activeDocumentId: string | null
}

const EventModalContext = createContext<EventModalContextValue | null>(null)

export function EventModalProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)

  const openModal = useCallback((id: string) => setActiveDocumentId(id), [])
  const closeModal = useCallback(() => setActiveDocumentId(null), [])

  const value = useMemo(
    () => ({ openModal, closeModal, activeDocumentId }),
    [openModal, closeModal, activeDocumentId]
  )

  return (
    <EventModalContext.Provider value={value}>
      {children}
    </EventModalContext.Provider>
  )
}

export function useEventModal(): EventModalContextValue {
  const ctx = useContext(EventModalContext)
  if (!ctx)
    throw new Error("useEventModal must be used inside EventModalProvider")

  return ctx
}
